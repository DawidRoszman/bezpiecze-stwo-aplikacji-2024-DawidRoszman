import { useKeycloak } from "@react-keycloak/web";

const Nav = () => {
  const { keycloak, initialized } = useKeycloak();


  return (
    <div>
      <div className="">
        <section className="">
          <nav className="flex">
            <div className="px-5 xl:px-12 py-6 w-full flex items-center">
              <h1 className="text-3xl font-bold font-heading">
                Catnasta user panel
              </h1>
              <ul className="hidden md:flex px-4 mx-auto font-semibold font-heading space-x-12">
                <li>
                  <a className="hover:text-blue-800" href="/">
                    Home
                  </a>
                </li>
                <li>
                  <a className="hover:text-blue-800" href="/secured">
                    Profile
                  </a>
                </li>
              </ul>
              <div className="flex items-center space-x-5">
                <div className="hover:text-gray-200">
                  {!keycloak.authenticated && (
                    <button
                      type="button"
                      className="text-blue-800"
                      onClick={() => keycloak.login()}
                    >
                      Login
                    </button>
                  )}

                  {!!keycloak.authenticated && (
                    <button
                      type="button"
                      className="text-teal-600 font-bold"
                      onClick={() => keycloak.logout()}
                    >
                      Logout ({keycloak.tokenParsed?.preferred_username})
                    </button>
                  )}
                </div>
              </div>
            </div>
          </nav>
        </section>
      </div>
    </div>
  );
};

export default Nav;