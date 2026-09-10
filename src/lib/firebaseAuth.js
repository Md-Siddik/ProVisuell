import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
  OAuthProvider,
  updateProfile,
  signOut,
  sendPasswordResetEmail,
} from "firebase/auth"
import { auth } from "../firebase/firebase.config"
import { api } from "./api"

const googleProvider = new GoogleAuthProvider()
const microsoftProvider = new OAuthProvider("microsoft.com")

export async function signUpWithEmail(name, email, password) {
  const cred = await createUserWithEmailAndPassword(auth, email, password)
  if (name) {
    await updateProfile(cred.user, { displayName: name })
    // AuthContext's own onAuthStateChanged-triggered sync can fire before
    // this displayName update lands (it's set by the account-creation
    // event, not this call), which would save the profile with no name.
    // Sync explicitly here, now that the name is guaranteed to be current.
    try {
      await api.post("/auth/sync", { name })
    } catch {
      // AuthContext's own sync will still run and catch up eventually.
    }
  }
  return cred.user
}

export async function loginWithEmail(email, password) {
  const cred = await signInWithEmailAndPassword(auth, email, password)
  return cred.user
}

export async function loginWithGoogle() {
  const cred = await signInWithPopup(auth, googleProvider)
  return cred.user
}

export async function loginWithMicrosoft() {
  const cred = await signInWithPopup(auth, microsoftProvider)
  return cred.user
}

export async function resetPassword(email) {
  await sendPasswordResetEmail(auth, email)
}

export async function logout() {
  await signOut(auth)
}

// Human-readable Norwegian messages for the login/signup forms.
export function friendlyAuthError(err) {
  const code = err?.code || ""
  const map = {
    "auth/invalid-email": "Ugyldig e-postadresse.",
    "auth/user-disabled": "Denne kontoen er deaktivert.",
    "auth/user-not-found": "Fant ingen konto med denne e-posten.",
    "auth/wrong-password": "Feil passord.",
    "auth/invalid-credential": "Feil e-post eller passord.",
    "auth/email-already-in-use": "Det finnes allerede en konto med denne e-posten.",
    "auth/weak-password": "Passordet må være minst 6 tegn.",
    "auth/popup-closed-by-user": "Innlogging avbrutt.",
    "auth/network-request-failed": "Nettverksfeil. Prøv igjen.",
  }
  return map[code] || "Noe gikk galt. Prøv igjen."
}
