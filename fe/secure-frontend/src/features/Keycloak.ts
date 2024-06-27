import Keycloak from "keycloak-js";
import { api } from "../helpers/server-route";
const keycloak = new Keycloak({
  url: api + ":8080",
  realm: "catnasta",
  clientId: "catnasta-spa",
});

export default keycloak;

