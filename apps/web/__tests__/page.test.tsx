import React from "react";
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";

// =============================================================================
// Landing Page component stub
//
// This mirrors the expected structure of the Drapnr landing page. Replace with
// the real import once apps/web/app/page.tsx is implemented.
// =============================================================================

function HeroSection() {
  return (
    <section data-testid="hero-section">
      <h1>Your Wardrobe, Digitized</h1>
      <p>
        Capture your clothes with your phone camera and try on outfits in a
        photorealistic 3D mirror.
      </p>
      <a href="/download" data-testid="cta-button">
        Download the App
      </a>
    </section>
  );
}

interface PricingTierProps {
  name: string;
  price: string;
  features: string[];
}

function PricingTier({ name, price, features }: PricingTierProps) {
  return (
    <div data-testid="pricing-tier">
      <h3>{name}</h3>
      <p data-testid="tier-price">{price}</p>
      <ul>
        {features.map((f) => (
          <li key={f}>{f}</li>
        ))}
      </ul>
    </div>
  );
}

function PricingSection() {
  const tiers: PricingTierProps[] = [
    {
      name: "Free",
      price: "$0/mo",
      features: ["5 outfits", "Basic try-on", "Standard quality"],
    },
    {
      name: "Plus",
      price: "$4.99/mo",
      features: ["25 outfits", "HD try-on", "Mix & match"],
    },
    {
      name: "Pro",
      price: "$9.99/mo",
      features: ["Unlimited outfits", "4K try-on", "Priority processing", "Export looks"],
    },
  ];

  return (
    <section data-testid="pricing-section">
      <h2>Choose Your Plan</h2>
      {tiers.map((tier) => (
        <PricingTier key={tier.name} {...tier} />
      ))}
    </section>
  );
}

function Navigation() {
  return (
    <nav data-testid="navigation">
      <a href="/">Home</a>
      <a href="/pricing">Pricing</a>
      <a href="/privacy">Privacy</a>
      <a href="/terms">Terms</a>
    </nav>
  );
}

function LandingPage() {
  return (
    <main>
      <Navigation />
      <HeroSection />
      <PricingSection />
    </main>
  );
}

// =============================================================================
// Tests
// =============================================================================

describe("Landing Page", () => {
  beforeEach(() => {
    render(<LandingPage />);
  });

  // -- Hero section --------------------------------------------------------

  describe("hero section", () => {
    it("renders the hero section", () => {
      expect(screen.getByTestId("hero-section")).toBeInTheDocument();
    });

    it("displays the main headline", () => {
      expect(
        screen.getByText("Your Wardrobe, Digitized")
      ).toBeInTheDocument();
    });

    it("displays a call-to-action button", () => {
      const cta = screen.getByTestId("cta-button");
      expect(cta).toBeInTheDocument();
      expect(cta).toHaveTextContent("Download the App");
    });

    it("includes a product description", () => {
      expect(
        screen.getByText(/capture your clothes/i)
      ).toBeInTheDocument();
    });
  });

  // -- Pricing section -----------------------------------------------------

  describe("pricing section", () => {
    it("renders the pricing section", () => {
      expect(screen.getByTestId("pricing-section")).toBeInTheDocument();
    });

    it("renders exactly 3 pricing tiers", () => {
      const tiers = screen.getAllByTestId("pricing-tier");
      expect(tiers).toHaveLength(3);
    });

    it("displays Free, Plus, and Pro tier names", () => {
      expect(screen.getByText("Free")).toBeInTheDocument();
      expect(screen.getByText("Plus")).toBeInTheDocument();
      expect(screen.getByText("Pro")).toBeInTheDocument();
    });

    it("displays prices for each tier", () => {
      const prices = screen.getAllByTestId("tier-price");
      expect(prices[0]).toHaveTextContent("$0/mo");
      expect(prices[1]).toHaveTextContent("$4.99/mo");
      expect(prices[2]).toHaveTextContent("$9.99/mo");
    });

    it("lists features for each tier", () => {
      expect(screen.getByText("5 outfits")).toBeInTheDocument();
      expect(screen.getByText("25 outfits")).toBeInTheDocument();
      expect(screen.getByText("Unlimited outfits")).toBeInTheDocument();
    });
  });

  // -- Navigation links ----------------------------------------------------

  describe("navigation", () => {
    it("renders the navigation bar", () => {
      expect(screen.getByTestId("navigation")).toBeInTheDocument();
    });

    it("contains links to Home, Pricing, Privacy, and Terms", () => {
      const nav = screen.getByTestId("navigation");
      const links = nav.querySelectorAll("a");

      const hrefs = Array.from(links).map((l) => l.getAttribute("href"));
      expect(hrefs).toContain("/");
      expect(hrefs).toContain("/pricing");
      expect(hrefs).toContain("/privacy");
      expect(hrefs).toContain("/terms");
    });

    it("renders correct link text", () => {
      expect(screen.getByText("Home")).toBeInTheDocument();
      expect(screen.getByText("Pricing")).toBeInTheDocument();
      expect(screen.getByText("Privacy")).toBeInTheDocument();
      expect(screen.getByText("Terms")).toBeInTheDocument();
    });
  });
});
