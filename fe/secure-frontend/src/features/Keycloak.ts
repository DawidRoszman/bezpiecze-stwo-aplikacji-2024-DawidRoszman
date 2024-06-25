import Keycloak from "keycloak-js";
const keycloak = new Keycloak({
 url: "http://localhost:8080",
 realm: "catnasta",
 clientId: "catnasta-api",
});

export default keycloak;