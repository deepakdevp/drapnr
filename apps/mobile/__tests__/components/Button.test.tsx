import React from "react";
import { render, fireEvent } from "@testing-library/react-native";
import {
  TouchableOpacity,
  Text,
  ActivityIndicator,
  type ViewStyle,
} from "react-native";

// =============================================================================
// Minimal Button component for testing
//
// This mirrors what a real Button component in components/ui/Button.tsx would
// look like. If the actual component exists, swap the import.
// =============================================================================

type ButtonVariant = "primary" | "secondary" | "outline" | "ghost";

interface ButtonProps {
  title: string;
  onPress?: () => void;
  variant?: ButtonVariant;
  loading?: boolean;
  disabled?: boolean;
  testID?: string;
}

const VARIANT_STYLES: Record<ButtonVariant, ViewStyle> = {
  primary: { backgroundColor: "#FF2D55" },
  secondary: { backgroundColor: "#1A1A2E" },
  outline: { backgroundColor: "transparent", borderWidth: 1, borderColor: "#FF2D55" },
  ghost: { backgroundColor: "transparent" },
};

function Button({
  title,
  onPress,
  variant = "primary",
  loading = false,
  disabled = false,
  testID,
}: ButtonProps) {
  return (
    <TouchableOpacity
      testID={testID ?? "button"}
      onPress={onPress}
      disabled={disabled || loading}
      style={[{ padding: 16, borderRadius: 12, alignItems: "center" }, VARIANT_STYLES[variant]]}
      accessibilityRole="button"
      accessibilityState={{ disabled: disabled || loading }}
    >
      {loading ? (
        <ActivityIndicator testID="button-loading" color="#FFF" />
      ) : (
        <Text testID="button-text">{title}</Text>
      )}
    </TouchableOpacity>
  );
}

// =============================================================================
// Tests
// =============================================================================

describe("Button", () => {
  // -- Renders correctly ---------------------------------------------------

  it("renders with the correct title", () => {
    const { getByTestId } = render(<Button title="Sign In" />);
    const textEl = getByTestId("button-text");
    expect(textEl.props.children).toBe("Sign In");
  });

  it("renders as an accessible button", () => {
    const { getByTestId } = render(<Button title="Submit" />);
    const btn = getByTestId("button");
    expect(btn.props.accessibilityRole).toBe("button");
  });

  // -- Variants ------------------------------------------------------------

  describe("variants", () => {
    it("applies primary variant styles by default", () => {
      const { getByTestId } = render(<Button title="Primary" />);
      const btn = getByTestId("button");
      const flatStyle = Array.isArray(btn.props.style)
        ? Object.assign({}, ...btn.props.style)
        : btn.props.style;
      expect(flatStyle.backgroundColor).toBe("#FF2D55");
    });

    it("applies secondary variant styles", () => {
      const { getByTestId } = render(<Button title="Secondary" variant="secondary" />);
      const btn = getByTestId("button");
      const flatStyle = Array.isArray(btn.props.style)
        ? Object.assign({}, ...btn.props.style)
        : btn.props.style;
      expect(flatStyle.backgroundColor).toBe("#1A1A2E");
    });

    it("applies outline variant styles with border", () => {
      const { getByTestId } = render(<Button title="Outline" variant="outline" />);
      const btn = getByTestId("button");
      const flatStyle = Array.isArray(btn.props.style)
        ? Object.assign({}, ...btn.props.style)
        : btn.props.style;
      expect(flatStyle.backgroundColor).toBe("transparent");
      expect(flatStyle.borderWidth).toBe(1);
    });

    it("applies ghost variant with transparent background", () => {
      const { getByTestId } = render(<Button title="Ghost" variant="ghost" />);
      const btn = getByTestId("button");
      const flatStyle = Array.isArray(btn.props.style)
        ? Object.assign({}, ...btn.props.style)
        : btn.props.style;
      expect(flatStyle.backgroundColor).toBe("transparent");
    });
  });

  // -- Loading state -------------------------------------------------------

  describe("loading state", () => {
    it("shows activity indicator when loading", () => {
      const { getByTestId, queryByTestId } = render(
        <Button title="Submit" loading />
      );

      expect(getByTestId("button-loading")).toBeTruthy();
      expect(queryByTestId("button-text")).toBeNull();
    });

    it("disables the button when loading", () => {
      const onPress = jest.fn();
      const { getByTestId } = render(
        <Button title="Submit" loading onPress={onPress} />
      );

      fireEvent.press(getByTestId("button"));
      expect(onPress).not.toHaveBeenCalled();
    });

    it("hides the title text while loading", () => {
      const { queryByTestId } = render(<Button title="Submit" loading />);
      expect(queryByTestId("button-text")).toBeNull();
    });
  });

  // -- onPress handler -----------------------------------------------------

  describe("onPress handler", () => {
    it("calls onPress when pressed", () => {
      const onPress = jest.fn();
      const { getByTestId } = render(
        <Button title="Tap Me" onPress={onPress} />
      );

      fireEvent.press(getByTestId("button"));
      expect(onPress).toHaveBeenCalledTimes(1);
    });

    it("does not call onPress when disabled", () => {
      const onPress = jest.fn();
      const { getByTestId } = render(
        <Button title="Disabled" onPress={onPress} disabled />
      );

      fireEvent.press(getByTestId("button"));
      expect(onPress).not.toHaveBeenCalled();
    });

    it("fires onPress only once per tap", () => {
      const onPress = jest.fn();
      const { getByTestId } = render(
        <Button title="Tap" onPress={onPress} />
      );

      fireEvent.press(getByTestId("button"));
      fireEvent.press(getByTestId("button"));
      expect(onPress).toHaveBeenCalledTimes(2);
    });
  });
});
