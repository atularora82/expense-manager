import React, { useState } from "react";
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signInWithPopup,
} from "firebase/auth";
import { auth, googleProvider } from "./firebase.js";

export default function AuthPanel() {
  const [mode, setMode] = useState("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function handleEmailSubmit(e) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      if (mode === "signin") {
        await signInWithEmailAndPassword(auth, email.trim(), password);
      } else {
        await createUserWithEmailAndPassword(auth, email.trim(), password);
      }
    } catch (err) {
      setError(friendlyAuthError(err));
    } finally {
      setBusy(false);
    }
  }

  async function handleGoogleSignIn() {
    setError("");
    setBusy(true);
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (err) {
      setError(friendlyAuthError(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      style={{
        fontFamily: "'Inter', sans-serif",
        background: "#F6F1E6",
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
        color: "#1F2A22",
      }}
    >
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,500;9..144,600&family=Inter:wght@400;500;600&display=swap');
        .auth-input {
          font-family: 'Inter', sans-serif;
          background: #FFFDF8;
          border: 1px solid #D8CDB4;
          border-radius: 4px;
          padding: 10px 12px;
          font-size: 14px;
          color: #1F2A22;
          width: 100%;
          outline: none;
        }
        .auth-input:focus {
          border-color: #C08A28;
          box-shadow: 0 0 0 3px rgba(192,138,40,0.15);
        }
        .auth-btn {
          font-family: 'Inter', sans-serif;
          font-weight: 600;
          font-size: 13px;
          letter-spacing: 0.04em;
          text-transform: uppercase;
          background: #1F2A22;
          color: #F6F1E6;
          border: none;
          border-radius: 4px;
          padding: 11px 18px;
          cursor: pointer;
          width: 100%;
        }
        .auth-btn:disabled { opacity: 0.6; cursor: not-allowed; }
        .auth-btn-ghost {
          background: transparent;
          color: #4A5A4E;
          border: 1px solid #D8CDB4;
          text-transform: none;
          letter-spacing: normal;
          font-weight: 500;
        }
      `}</style>

      <div
        style={{
          width: "100%",
          maxWidth: 400,
          background: "#FFFDF8",
          border: "1px solid #D8CDB4",
          borderRadius: 8,
          padding: "32px 28px",
        }}
      >
        <div
          style={{
            fontSize: 11,
            fontWeight: 600,
            letterSpacing: "0.14em",
            textTransform: "uppercase",
            color: "#74836A",
            marginBottom: 6,
          }}
        >
          Cloud sync
        </div>
        <h1
          style={{
            fontFamily: "'Fraunces', serif",
            fontSize: 28,
            fontWeight: 600,
            margin: "0 0 8px",
          }}
        >
          Sign in to Expense Book
        </h1>
        <p style={{ fontSize: 14, color: "#74836A", margin: "0 0 24px", lineHeight: 1.5 }}>
          Your ledger is saved to Firebase and syncs across devices.
        </p>

        <form onSubmit={handleEmailSubmit} style={{ display: "grid", gap: 12 }}>
          <input
            className="auth-input"
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="email"
          />
          <input
            className="auth-input"
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={6}
            autoComplete={mode === "signin" ? "current-password" : "new-password"}
          />
          {error && (
            <div style={{ color: "#A93B3B", fontSize: 13 }}>{error}</div>
          )}
          <button className="auth-btn" type="submit" disabled={busy}>
            {busy ? "Please wait..." : mode === "signin" ? "Sign in" : "Create account"}
          </button>
        </form>

        <button
          className="auth-btn auth-btn-ghost"
          type="button"
          style={{ marginTop: 12 }}
          onClick={handleGoogleSignIn}
          disabled={busy}
        >
          Continue with Google
        </button>

        <div style={{ marginTop: 18, fontSize: 13, color: "#74836A", textAlign: "center" }}>
          {mode === "signin" ? (
            <>
              New here?{" "}
              <button
                type="button"
                onClick={() => {
                  setMode("signup");
                  setError("");
                }}
                style={{
                  background: "none",
                  border: "none",
                  color: "#1F2A22",
                  fontWeight: 600,
                  cursor: "pointer",
                  padding: 0,
                }}
              >
                Create an account
              </button>
            </>
          ) : (
            <>
              Already have an account?{" "}
              <button
                type="button"
                onClick={() => {
                  setMode("signin");
                  setError("");
                }}
                style={{
                  background: "none",
                  border: "none",
                  color: "#1F2A22",
                  fontWeight: 600,
                  cursor: "pointer",
                  padding: 0,
                }}
              >
                Sign in
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function friendlyAuthError(err) {
  const code = err?.code || "";
  if (code === "auth/invalid-credential" || code === "auth/wrong-password") {
    return "Invalid email or password.";
  }
  if (code === "auth/email-already-in-use") {
    return "An account with this email already exists.";
  }
  if (code === "auth/weak-password") {
    return "Password should be at least 6 characters.";
  }
  if (code === "auth/popup-closed-by-user") {
    return "Sign-in popup was closed.";
  }
  return err?.message || "Authentication failed. Try again.";
}
