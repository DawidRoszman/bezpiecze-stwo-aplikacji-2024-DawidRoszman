import { useKeycloak } from "@react-keycloak/web";
import { ReactNode } from "react";

const PrivateRoute = ({ children }: { children: ReactNode }) => {
  const { keycloak } = useKeycloak();

  const isLoggedIn = keycloak.authenticated;

  return isLoggedIn ? children : <div className="text-3xl">You are not authorized to access this page! Log in first</div>;
};

export default PrivateRoute;