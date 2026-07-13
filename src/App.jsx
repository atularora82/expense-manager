import React, { useEffect, useState } from "react";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { auth, isFirebaseConfigured } from "./firebase.js";
import { installFirebaseStorage } from "./firebaseStorage.js";
import { installLocalStorage } from "./localStorageAdapter.js";
import { migrateLocalToFirebase } from "./migrateLocalToFirebase.js";
import AuthPanel from "./AuthPanel.jsx";
import ExpenseLedger from "./ExpenseLedger.jsx";

export default function App() {
  const [user, setUser] = useState(null);
  const [ready, setReady] = useState(!isFirebaseConfigured());

  useEffect(() => {
    if (!isFirebaseConfigured()) {
      installLocalStorage();
      return;
    }

    const unsubscribe = onAuthStateChanged(auth, async (nextUser) => {
      if (nextUser) {
        installFirebaseStorage(nextUser.uid);
        await migrateLocalToFirebase(nextUser.uid);
      } else {
        installLocalStorage();
      }
      setUser(nextUser);
      setReady(true);
    });

    return unsubscribe;
  }, []);

  if (!ready) {
    return (
      <div
        style={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#F6F1E6",
          color: "#74836A",
          fontFamily: "Inter, sans-serif",
        }}
      >
        Loading...
      </div>
    );
  }

  if (isFirebaseConfigured() && !user) {
    return <AuthPanel />;
  }

  return (
    <ExpenseLedger
      key={user?.uid ?? "local"}
      user={user}
      cloudSync={Boolean(user)}
      onSignOut={user ? () => signOut(auth) : undefined}
    />
  );
}
