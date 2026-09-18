import { Routes, Route } from "react-router-dom"
import { AuthProvider } from "./context/AuthContext"
import ProtectedRoute from "./context/ProtectedRoute"
import PublicLayout from "./layouts/PublicLayout"

import MarketingSite from "./pages/MarketingSite"
import Login from "./pages/Login"
import Signup from "./pages/Signup"
import VerifyEmail from "./pages/VerifyEmail"
import DashboardRedirect from "./pages/DashboardRedirect"
import MineBestillinger from "./pages/customer/MineBestillinger"
import OrderConfirmation from "./pages/customer/OrderConfirmation"
import FakturaVisning from "./pages/FakturaVisning"

import DashboardLayout from "./dashboard/DashboardLayout"
import Overview from "./dashboard/pages/Overview"
import Ansattmoter from "./dashboard/pages/Ansattmoter"
import Meldinger from "./dashboard/pages/Meldinger"
import NyOrdre from "./dashboard/pages/NyOrdre"
import Ordreoversikt from "./dashboard/pages/Ordreoversikt"
import Kundebetalinger from "./dashboard/pages/Kundebetalinger"
import Utgifter from "./dashboard/pages/Utgifter"
import Rapporter from "./dashboard/pages/Rapporter"
import WebsiteEditor from "./dashboard/pages/WebsiteEditor"
import Lokasjoner from "./dashboard/pages/Lokasjoner"

function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route element={<PublicLayout />}>
          <Route path="/" element={<MarketingSite />} />
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Signup />} />
          <Route path="/verify-email" element={<VerifyEmail />} />
          <Route
            path="/mine-bestillinger"
            element={
              <ProtectedRoute roles={["customer"]}>
                <MineBestillinger />
              </ProtectedRoute>
            }
          />
          <Route
            path="/mine-bestillinger/:id"
            element={
              <ProtectedRoute roles={["customer"]}>
                <OrderConfirmation />
              </ProtectedRoute>
            }
          />
        </Route>

        <Route path="/dashboard" element={<ProtectedRoute><DashboardRedirect /></ProtectedRoute>} />

        {/* Standalone — the invoice document has its own light, print-
            friendly design and must not be wrapped in the dark site chrome.
            Reachable by owner, administrator, or the invoice's own customer;
            ownership itself is enforced server-side. */}
        <Route
          path="/faktura/:invoiceId"
          element={
            <ProtectedRoute>
              <FakturaVisning />
            </ProtectedRoute>
          }
        />

        <Route
          path="/dashboard/owner"
          element={
            <ProtectedRoute roles={["owner"]}>
              <DashboardLayout />
            </ProtectedRoute>
          }
        >
          <Route index element={<Overview />} />
          <Route path="ansattmoter" element={<Ansattmoter />} />
          <Route path="meldinger" element={<Meldinger />} />
          <Route path="ordre/ny" element={<NyOrdre />} />
          <Route path="ordreoversikt" element={<Ordreoversikt />} />
          <Route path="kundebetalinger" element={<Kundebetalinger />} />
          <Route path="utgifter" element={<Utgifter />} />
          <Route path="rapporter" element={<Rapporter />} />
          <Route path="lokasjoner" element={<Lokasjoner />} />
        </Route>

        <Route
          path="/dashboard/admin"
          element={
            <ProtectedRoute roles={["administrator"]}>
              <DashboardLayout />
            </ProtectedRoute>
          }
        >
          <Route index element={<Overview />} />
          <Route path="ansattmoter" element={<Ansattmoter />} />
          <Route path="meldinger" element={<Meldinger />} />
          <Route path="ordre/ny" element={<NyOrdre />} />
          <Route path="ordreoversikt" element={<Ordreoversikt />} />
          <Route path="kundebetalinger" element={<Kundebetalinger />} />
          <Route path="utgifter" element={<Utgifter />} />
          <Route path="rapporter" element={<Rapporter />} />
          <Route path="lokasjoner" element={<Lokasjoner />} />
          <Route path="website-editor" element={<WebsiteEditor />} />
        </Route>
      </Routes>
    </AuthProvider>
  )
}

export default App
