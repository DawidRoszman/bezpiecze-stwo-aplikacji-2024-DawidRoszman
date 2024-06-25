import './App.css'
import Nav from './components/Nav'
import { BrowserRouter, Route, Routes } from 'react-router-dom'
import Home from './pages/Home'
import Secured from './pages/Secured'
import { ReactKeycloakProvider } from '@react-keycloak/web'
import keycloak from './features/Keycloak'
import PrivateRoute from './helpers/PrivateRoute'

function App() {

  return (
    <>
      <ReactKeycloakProvider authClient={keycloak}>
        <Nav />
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/secured" element={<PrivateRoute><Secured /></PrivateRoute>} />
          </Routes>
        </BrowserRouter>
      </ReactKeycloakProvider>
    </>
  )
}

export default App
