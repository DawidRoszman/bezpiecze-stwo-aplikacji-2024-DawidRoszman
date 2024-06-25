import { useKeycloak } from "@react-keycloak/web";

const Secured = () => {

  const { keycloak } = useKeycloak();
  console.log(keycloak.tokenParsed)
  return (
    <div>
      <h1 className="heading text-4xl">Welcome {keycloak.tokenParsed?.upn}!</h1>
      <button className="border-2 border-white p-2 rounded hover:bg-white hover:text-black m-2" onClick={() => { keycloak.accountManagement() }}>Edit your information</button>
      <div>
        <h1>Your current information: </h1>
        <ul>
          <li>Name: <span className="text-teal-200">{keycloak.tokenParsed?.given_name}</span></li>
          <li>Last name: <span className="text-teal-200">{keycloak.tokenParsed?.family_name}</span></li>
          <li>Username: <span className="text-teal-200">{keycloak.tokenParsed?.upn}</span></li>
          <li>Token expires at: <span className="text-teal-200">{new Date(keycloak.tokenParsed!.exp! * 1000).toUTCString()}</span></li>
          <li>
            Roles:
            <ul>
              {keycloak.tokenParsed?.realm_access?.roles.map((role, id) => (
                <li key={id}><span className="text-teal-200">{role}</span></li>)
              )}
            </ul>
          </li>
        </ul>
      </div>
    </div>
  );
};

export default Secured;