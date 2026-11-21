import { useEffect } from "react";
import { Route, Router, useLocation } from "wouter";
import { CartProvider } from "./lib/cart";
import Storefront from "./components/Storefront";
import Admin from "./components/Admin";
import ProductPage from "./components/ProductPage";
import Tracking from "./components/Tracking";

function ScrollToTop() {
  const [location] = useLocation();
  useEffect(() => { window.scrollTo(0, 0); }, [location]);
  return null;
}

export default function App() {
  return (
    <CartProvider>
      <Router>
        <ScrollToTop />
        <Route path="/product/:id" component={ProductPage} />
        <Route path="/track" component={Tracking} />
        <Route path="/admin" component={Admin} />
        <Route path="/" component={Storefront} />
      </Router>
    </CartProvider>
  );
}
