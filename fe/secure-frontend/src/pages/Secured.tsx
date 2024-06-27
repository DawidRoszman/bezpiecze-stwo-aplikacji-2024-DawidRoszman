import { useKeycloak } from "@react-keycloak/web";
import { api } from "../helpers/server-route";
import { useEffect, useState } from "react";

interface Message {
  id: string;
  message: string;
  username: string;
  _id: string;
}

const Secured = () => {
  const { keycloak } = useKeycloak();
  const [messages, setMessages] = useState<Message[]>([]);
  useEffect(() => {
    const fetchMessages = async () => {
      const response = await fetch(api + ":5000/user/chat/messages", {
        headers: {
          Authorization: `Bearer ${keycloak.token}`,
        },
      });
      const data = await response.json();
      setMessages(data.messages);
      console.log(data);
    };
    fetchMessages();
  }, []);
  console.log(keycloak.tokenParsed);
  console.log(keycloak.token);

  return (
    <div>
      <h1 className="heading text-4xl">Welcome {keycloak.tokenParsed?.upn}!</h1>
      {(keycloak.tokenParsed?.realm_access?.roles.includes("admin") ||
        keycloak.tokenParsed?.realm_access?.roles.includes("moderator")) && (
        <a
          href={api + ":8080/admin/catnasta/console"}
          className="border-2 border-white p-2 rounded hover:bg-white hover:text-black m-2"
        >
          Go to dashboard
        </a>
      )}
      <button
        className="border-2 border-white p-2 rounded hover:bg-white hover:text-black m-2"
        onClick={() => {
          keycloak.accountManagement();
        }}
      >
        Edit your information
      </button>
      <div>
        <h1>Your current information: </h1>
        <ul>
          <li>
            Name:{" "}
            <span className="text-teal-200">
              {keycloak.tokenParsed?.given_name}
            </span>
          </li>
          <li>
            Last name:{" "}
            <span className="text-teal-200">
              {keycloak.tokenParsed?.family_name}
            </span>
          </li>
          <li>
            Username:{" "}
            <span className="text-teal-200">{keycloak.tokenParsed?.upn}</span>
          </li>
          <li>
            Token expires at:{" "}
            <span className="text-teal-200">
              {new Date(keycloak.tokenParsed!.exp! * 1000).toUTCString()}
            </span>
          </li>
          <li>
            Roles:
            <ul>
              {keycloak.tokenParsed?.realm_access?.roles.map((role, id) => (
                <li key={id}>
                  <span className="text-teal-200">{role}</span>
                </li>
              ))}
            </ul>
          </li>
        </ul>
        <div>
          <h1>Your messages: </h1>
          {!messages ? (
            <div>Still loading or no messages to show</div>
          ) : (
            <div>
              <ul>
                {messages.map((message, id) => (
                  <li key={id}>
                    Message ID:{" "}
                    <span className="text-teal-200">{message.id}</span>
                    <br />
                    Message:{" "}
                    <span className="text-teal-400">{message.message}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Secured;

