import express, { Express, Request, Response } from "express";
import mqtt from "mqtt";
import cors from "cors";
import fs from "fs";
import jwt from "jsonwebtoken";
import {
  discardCardDispatch,
  dispatchAddToMeld,
  drawCardDispatch,
  games,
  meldCardDispatch,
  startRoundDispatch,
} from "./src/gameService";
import { MongoClient, ObjectId, ServerApiVersion } from "mongodb";
import axios from "axios";
const config = require(`./src/keycloak.json`)
const Keycloak = require('keycloak-connect');
const keycloak = new Keycloak({ store: false }, config);

require("dotenv").config();

const clientId = "mqttjs_server_" + Math.random().toString(16).slice(2, 8);
const client = mqtt.connect("wss://broker.emqx.io:8084/mqtt", {
  clientId: clientId,
});

const uri = process.env.MONGO_URI || "";

const mongoClient = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});


async function run() {
  try {
    await mongoClient.connect();
    await mongoClient.db("admin").command({ ping: 1 });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!",
    );
  } finally {
    await mongoClient.close();
  }
}
run().catch((err) => {
  console.log(err);
  fs.appendFileSync("log.json", JSON.stringify(err));
});


client.publish("catnasta", "Hello mqtt");

const app: Express = express();
const port = 5000;
app.use(express.json());
app.use(cors());

app.use(keycloak.middleware({logout: '/logout'}));
client.subscribe("catnasta/chat");
client.subscribe("catnasta/game");

client.on("message", async (topic, message) => {
  if (topic === "catnasta/chat") {
    const msg = JSON.parse(message.toString());
    if (!msg.username || !msg.message) {
      return;
    }
    await mongoClient.connect();
    await mongoClient.db("catnasta").collection("chat").insertOne({
      id: msg.id,
      username: msg.username,
      message: msg.message,
    });
  }
  if (topic === "catnasta/game") {
    const msg = JSON.parse(message.toString());
    const game = games.find((game) => game.gameId === msg.id);
    if (game === undefined) {
      return;
    }
    const { gameState } = game;
    switch (msg.type) {
      case "PLAYER_JOINED":
        if (
          msg.name !== gameState.player1.name &&
          msg.name !== gameState.player2.name
        ) {
          return;
        }
        if (msg.name === undefined) {
          return;
        }
        client.publish(
          `catnasta/game/${msg.id}`,
          JSON.stringify({
            type: "PLAYER_JOINED",
            player1: gameState.player1.name,
            player2: gameState.player2.name,
          }),
        );
        if (gameState.player1.name && gameState.player2.name) {
          startRoundDispatch(client, gameState, msg);
        }
        break;
      case "PLAYER_LEFT":
        client.publish(
          `catnasta/game/${msg.id}`,
          JSON.stringify({
            type: "PLAYER_LEFT",
            player: msg.name,
          }),
        );
      case "DRAW_FROM_STOCK":
        drawCardDispatch(client, gameState, msg);
        break;
      case "DISCARD_CARD":
        discardCardDispatch(client, gameState, msg, mongoClient, games);
        break;
      case "MELD_CARDS":
        console.log(msg);
        meldCardDispatch(client, gameState, msg);
        break;
      case "ADD_TO_MELD":
        console.log(msg);
        dispatchAddToMeld(client, gameState, msg);
        break;
    }
  }
});

app.get("/userinfo", keycloak.protect(), async (req:any, res) => {
  return res.send(req.kauth.grant.access_token.content);
});
// app.get("/userinfo", keycloak.protect(), async (req, res) => {
//   if (!req.headers.authorization) {
//     return res.status(401).send('No authorization header');
//   }
//   console.log(req.headers.authorization)
//   const decoded = jwt.decode(req.headers.authorization?.toString().split(" ")[1]); 
//   if (!decoded) {
//     return res.status(401).send('Invalid token');
//   }
//   if (typeof decoded === 'object' && decoded !== null && 'preferred_username' in decoded) {
//     const username = decoded.preferred_username;
//     res.send({ username }); // Send username as an object for consistency
//   } else {
//     return res.status(401).send('Invalid token or username not found');
//   }
// })


// app.post("/login", async (req: Request, res: Response) => {
//   const username: string = req.body.username;
//   const password: string = req.body.password;
//   if (!username) {
//     return res.send({ msg: "Please enter a username" });
//   }
//   if (!password) {
//     return res.send({ msg: "Please enter a password" });
//   }
//   await mongoClient.connect();
//   const query = mongoClient
//     .db("catnasta")
//     .collection("users")
//     .findOne({ username: username });
//   const user = await query;
//   if (user === null) {
//     return res.send({ msg: "Wrong username or password" });
//   }
//   bcrypt.compare(password, user.password, function (err, result) {
//     if (result) {
//       const token = generateAccessToken(username);
//       return res.send({ token: token });
//     } else {
//       return res.send({ msg: "Wrong username or password" });
//     }
//   });
// });

app.delete(
  "/chat/delete/:id",
  keycloak.protect(),
  async (req: any, res: Response) => {
    try {
      const id = req.params.id;
      console.log(id);
      await mongoClient.connect();
      const query = mongoClient.db("catnasta").collection("chat").findOne({
        id: id,
      });
      const message = await query;
      if (message === null) {
        return res.send({ msg: "Message not found" });
      }
      if (
        message.username !== req.kauth.grant.access_token.preferred_username &&
        !req.kauth.grant.access_token.realm_access.roles.includes("admin")) {
        return res.send({ msg: "You can only delete your own messages" });
      }
      await mongoClient.db("catnasta").collection("chat").deleteOne({ id: id });
      return res.send({ msg: "Message deleted" });
    } catch (err) {
      return res.send({ msg: "Message not found" });
    }
  },
);

app.put(
  "/chat/update/:id",
  keycloak.protect(),
  async (req: any, res: Response) => {
    try {
      const id = req.params.id;
      const message = req.body.message;
      await mongoClient.connect();
      const query = mongoClient.db("catnasta").collection("chat").findOne({
        id: id,
      });
      const msg = await query;
      if (msg === null) {
        return res.send({ msg: "Message not found" });
      }
      if (
        msg.username !== req.kauth.grant.access_token.preferred_username &&
        !req.kauth.grant.access_token.realm_access.roles.includes("admin")
      ) {
        return res.send({ msg: "You can only edit your own messages" });
      }
      await mongoClient
        .db("catnasta")
        .collection("chat")
        .updateOne({ id: id }, { $set: { message: message } });
      return res.send({ msg: "Message updated" });
    } catch (err) {
      return res.send({ msg: "Message not found" });
    }
  },
);

app.post("/send", keycloak.protect('realm:admin'), async (req: any, res: Response) => {
  const message = req.body.message;
  client.publish("catnasta/messages", JSON.stringify({ message: message }));
  fs.appendFileSync("log.json", JSON.stringify(message));
  res.status(200).send({ msg: "Message sent" });
});

app.post("/chat", keycloak.protect(), async (req: any, res: Response) => {
  try {
    const message = req.body.message;
    await mongoClient.connect();
    await mongoClient.db("catnasta").collection("chat").insertOne({
      username: req.kauth.grant.access_token.preferred_username,
      message: message,
    });
  } catch (error) {}
});

app.get("/chat", async (req: Request, res: Response) => {
  await mongoClient.connect();
  const query = mongoClient.db("catnasta").collection("chat").find();
  const chat = await query.toArray();
  return res.send(chat);
});

app.get("/chat/search", async (req: Request, res: Response) => {
  const search = req.query.search;
  if (!search) {
    return res.send({ msg: "Please enter a search term" });
  }
  await mongoClient.connect();
  const query = mongoClient
    .db("catnasta")
    .collection("chat")
    .find({
      message: { $regex: `.*${search}.*` as string },
    });
  const result = await query.toArray();
  return res.send(result);
});

app.get("/login", (req, res) => {
  const redirectUrl = `http://localhost:8080/realms/catnasta/protocol/openid-connect/auth?client_id=catnasta-api&redirect_uri=http://localhost:5000/callback&response_type=code&scope=openid`;
  res.redirect(redirectUrl);
})

app.get("/logged", keycloak.protect(), (req, res) => {
  res.send("You are logged in");
});

app.get('/callback', async (req, res) => {
  const code = req.query.code;
  
  if (!code) {
    return res.status(400).send('Authorization code is missing');
  }

  try {
    const tokenUrl = 'http://localhost:8080/realms/catnasta/protocol/openid-connect/token';
    const data = {
      grant_type: 'authorization_code',
      client_id: config.resource,
      client_secret: config.credentials.secret,
      code: code.toString(),
      redirect_uri: 'http://localhost:5000/callback',
    };
    const params = new URLSearchParams(data);

    const response = await axios.post(tokenUrl, params, {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
    });

    const { access_token, refresh_token, id_token } = response.data;

    // Store the tokens in session or cookies as needed
    res.cookie('accessToken', access_token);
    res.cookie('refreshToken', refresh_token);
    res.cookie('idToken', id_token);

    return res.redirect('http://localhost:3000');
  } catch (error) {
    console.error('Error exchanging code for token:', error);
    res.status(500).send('Failed to exchange code for token');
  }
});


app.get("/", (req: Request, res: Response) => {
  return res.send("Welcome to Catnasta");
});

app.get("/users", keycloak.protect('realm:admin'), async (req: any, res: Response) => {
  await mongoClient.connect();
  const query = mongoClient.db("catnasta").collection("users").find();
  const users = await query.toArray();
  return res.send(users);
});

app.get("/user", keycloak.protect(), async (req: any, res: Response) => {
  const user = req.kauth.grant.access_token.content.upn;
  console.log(user)
  await mongoClient.connect();
  const query = mongoClient.db("catnasta").collection("users").findOne({
    username: user,
  });
  const result = await query;
  if (result === null) {
    // Create a new user
    await mongoClient.db("catnasta").collection("users").insertOne({
      username: user,
    });
    return res.send(user);
  }
  return res.send(result.username);
});

app.get(
  "/user/isAdmin",
  keycloak.protect(),
  async (req: any, res: Response) => {
    const admin = req.kauth.grant.access_token.realm_access.roles.includes("admin");
    if (!admin) {
      return res.send({ isAdmin: false });
    }
    return res.send({ isAdmin: true });
  },
);
//dwa

app.get(
  "/users/:id",
  keycloak.protect('realm:admin'),
  async (req: any, res: Response) => {
    const id = req.params.id;
    await mongoClient.connect();
    const query = mongoClient
      .db("catnasta")
      .collection("users")
      .findOne({ _id: new ObjectId(id) });
    const result = await query;
    if (result === null) {
      return res.send({ msg: "User not found" });
    }
    return res.send(result);
  },
);

app.delete(
  "/users/:id",
  keycloak.protect('realm:admin'),
  async (req: Request, res: Response) => {
    const id = req.params.id;
    await mongoClient.connect();
    const query = mongoClient
      .db("catnasta")
      .collection("users")
      .findOne({ _id: new ObjectId(id) });
    const result = await query;
    if (result === null) {
      return res.send({ msg: "User not found" });
    }
    mongoClient
      .db("catnasta")
      .collection("users")
      .deleteOne({ _id: new ObjectId(id) });
    return res.send({ msg: "User deleted" });
  },
);

// app.put(
//   "/user/edit_password",
//   keycloak.protect(),
//   async (req: Request, res: Response) => {
//     const user = req.body.user.data;
//     const oldPassword = req.body.oldPassword;
//     const newPassword = req.body.newPassword;
//     if (!newPassword || !oldPassword) {
//       return res.send({ msg: "Please enter an old password and new password" });
//     }
//     await mongoClient.connect();
//     const query = mongoClient
//       .db("catnasta")
//       .collection("users")
//       .findOne({ username: user });
//     const result = await query;
//     if (result === null) {
//       return res.send({ msg: "User not found" });
//     }
//     bcrypt.compare(oldPassword, result.password, function (err, result) {
//       if (result) {
//         bcrypt.genSalt(10, function (err, salt) {
//           bcrypt.hash(newPassword, salt, async function (err, hash) {
//             await mongoClient
//               .db("catnasta")
//               .collection("users")
//               .updateOne({ username: user }, { $set: { password: hash } });
//             return res.send({ msg: "Password changed" });
//           });
//         });
//       } else {
//         return res.send({ msg: "Wrong password" });
//       }
//     });
//   },
// );

app.put("/admin/user/edit/:id", keycloak.protect('realm:admin'), async (req, res) => {
  const id = req.params.id;
  const newUsername = req.body.newUsername;
  const query = mongoClient
    .db("catnasta")
    .collection("users")
    .findOne({
      _id: new ObjectId(id),
    });
  const result = await query;
  if (result === null) {
    return res.send({ msg: "User not found" });
  }
  const query2 = mongoClient.db("catnasta").collection("users").findOne({
    username: newUsername,
  });
  const result2 = await query2;
  if (result2 !== null) {
    return res.send({ msg: "Username already taken" });
  }
  mongoClient
    .db("catnasta")
    .collection("users")
    .updateOne(
      {
        _id: new ObjectId(id),
      },
      { $set: { username: newUsername } },
    );
});

app.get("/games", keycloak.protect('realm:admin'), async (req: Request, res: Response) => {
  await mongoClient.connect();
  const query = mongoClient.db("catnasta").collection("games").find();
  const games = await query.toArray();
  return res.send(games);
});

app.get(
  "/live_games",
  keycloak.protect(),
  async (req: Request, res: Response) => {
    return res.status(200).send(
      games.map((game) => {
        return {
          id: game.gameId,
          players_in_game:
            game.gameState.player1.name && game.gameState.player2.name ? 2 : 1,
        };
      }),
    );
  },
);

app.delete("/games/:id", keycloak.protect('realm:admin'), async (req, res) => {
  const id = req.params.id;
  await mongoClient.connect();
  const query = mongoClient
    .db("catnasta")
    .collection("games")
    .findOne({
      _id: new ObjectId(id),
    });
  const result = await query;
  if (result === null) {
    return res.send({ msg: "Game not found" });
  }
  mongoClient
    .db("catnasta")
    .collection("games")
    .deleteOne({ _id: new ObjectId(id) });
  return res.send({ msg: "Game deleted" });
});

app.post("/create_game", keycloak.protect() , async (req: any, res: Response) => {
  const name = req.kauth.grant.access_token.content.upn;
  if (!name) {
    return res.send({ msg: "Please log in to create game" });
  }
  const id = Math.random().toString(36).substring(2, 8).toUpperCase();
  const game = {
    gameId: id,
    gameState: {
      turn: "",
      gameOver: false,
      gameStarted: false,
      player1: {
        name: name,
        hand: [],
        melds: [],
        red_threes: [],
        score: 0,
      },
     player2: {
        name: "",
        hand: [],
        melds: [],
        red_threes: [],
        score: 0,
      },
      stock: [],
      discardPile: [],
    },
  };
  games.push(game);
  client.publish(
    "catnasta/game_list",
    JSON.stringify(
      games.map((game) => {
        return {
          id: game.gameId,
          players_in_game:
            game.gameState.player1.name && game.gameState.player2.name ? 2 : 1,
        };
      }),
    ),
  );
  return res.send({ id: game.gameId });
});

app.put("/join_game", keycloak.protect() , async (req: any, res: Response) => {
  const id: string = req.body.id.toUpperCase();
  const name = req.kauth.grant.access_token.content.upn;
  if (!id) {
    return res.send({ msg: "Please enter a game id" });
  }
  if (!name) {
    return res.send({ msg: "Please log in to join game" });
  }
  const game = games.find((game) => game.gameId === id);
  if (game === undefined) {
    return res.send({ msg: "Game not found" });
  }
  const { gameState } = game;
  if (gameState.player1.name && gameState.player2.name) {
    return res.send({ msg: "Game is full" });
  }
  if (gameState.player1.name && !gameState.player2.name) {
    if (gameState.player1.name === name) {
      return res.send({ msg: "Name already taken" });
    }
    const updatedGame = { ...game };
    updatedGame.gameState.player2.name = name;
    games.map((game) => {
      if (game.gameId === id) return updatedGame;
    });
    client.publish(
      "catnasta/game_list",
      JSON.stringify(
        games.map((game) => {
          return {
            id: game.gameId,
            players_in_game:
              game.gameState.player1.name && game.gameState.player2.name
                ? 2
                : 1,
          };
        }),
      ),
    );
    return res.send({ id: id });
  }
  return res.send({ msg: "Game not found" });
});

app.listen(port, () => {
    console.log(`[server]: Server is running at http://localhost:${port}`);
  });
// app.listen(port, () => {
//   console.log(`[server]: Server is running at http://localhost:${port}`);
// });
