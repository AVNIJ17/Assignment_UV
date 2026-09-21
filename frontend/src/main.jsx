import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import CssBaseline from "@mui/material/CssBaseline";
import { ThemeProvider, createTheme } from "@mui/material/styles";

import App from "./App.jsx";
import { AppProvider } from "./context/AppContext.jsx";

const theme = createTheme({
  palette: { background: { default: "#f4f6f8" }, primary: { main: "#1f6feb" } },
  shape: { borderRadius: 10 },
  typography: { fontFamily: "Inter, Roboto, system-ui, sans-serif" },
});

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <BrowserRouter>
        <AppProvider>
          <App />
        </AppProvider>
      </BrowserRouter>
    </ThemeProvider>
  </React.StrictMode>
);
