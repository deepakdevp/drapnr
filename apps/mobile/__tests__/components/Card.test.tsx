import React from "react";
import { render, fireEvent } from "@testing-library/react-native";
import { View, Text, TouchableOpacity, type ViewStyle } from "react-native";

// =============================================================================
// Minimal Card component for testing
//
// This mirrors a typical Card component in components/ui/Card.tsx.
// Swap the import when the real component is available.
// =============================================================================

interface CardProps {
  children: React.ReactNode;
  pressable?: boolean;
  onPress?: () => void;
  testID?: string;
  style?: ViewStyle;
}

const cardStyle: ViewStyle = {
  backgroundColor: "#1A1A2E",
  borderRadius: 16,
  padding: 16,
  shadowColor: "#000",
  shadowOffset: { width: 0, height: 2 },
  shadowOpacity: 0.1,
  shadowRadius: 8,
  elevation: 3,
};

function Card({ children, pressable, onPress, testID, style }: CardProps) {
  if (pressable) {
    return (
      <TouchableOpacity
        testID={testID ?? "card"}
        onPress={onPress}
        style={[cardStyle, style]}
        activeOpacity={0.8}
        accessibilityRole="button"
      >
        {children}
      </TouchableOpacity>
    );
  }

  return (
    <View testID={testID ?? "card"} style={[cardStyle, style]}>
      {children}
    </View>
  );
}

// =============================================================================
// Tests
// =============================================================================

describe("Card", () => {
  // -- Renders correctly ---------------------------------------------------

  it("renders children content", () => {
    const { getByText } = render(
      <Card>
        <Text>Hello World</Text>
      </Card>
    );

    expect(getByText("Hello World")).toBeTruthy();
  });

  it("renders with default styling", () => {
    const { getByTestId } = render(
      <Card>
        <Text>Content</Text>
      </Card>
    );

    const card = getByTestId("card");
    const flatStyle = Array.isArray(card.props.style)
      ? Object.assign({}, ...card.props.style)
      : card.props.style;

    expect(flatStyle.borderRadius).toBe(16);
    expect(flatStyle.backgroundColor).toBe("#1A1A2E");
  });

  it("renders multiple children", () => {
    const { getByText } = render(
      <Card>
        <Text>Title</Text>
        <Text>Subtitle</Text>
        <Text>Description</Text>
      </Card>
    );

    expect(getByText("Title")).toBeTruthy();
    expect(getByText("Subtitle")).toBeTruthy();
    expect(getByText("Description")).toBeTruthy();
  });

  it("accepts custom testID", () => {
    const { getByTestId } = render(
      <Card testID="outfit-card">
        <Text>Outfit</Text>
      </Card>
    );

    expect(getByTestId("outfit-card")).toBeTruthy();
  });

  // -- Pressable variant ---------------------------------------------------

  describe("pressable variant", () => {
    it("renders as TouchableOpacity when pressable", () => {
      const { getByTestId } = render(
        <Card pressable>
          <Text>Tap me</Text>
        </Card>
      );

      const card = getByTestId("card");
      expect(card.props.accessibilityRole).toBe("button");
    });

    it("fires onPress when tapped", () => {
      const onPress = jest.fn();
      const { getByTestId } = render(
        <Card pressable onPress={onPress}>
          <Text>Tap me</Text>
        </Card>
      );

      fireEvent.press(getByTestId("card"));
      expect(onPress).toHaveBeenCalledTimes(1);
    });

    it("does not have button role when not pressable", () => {
      const { getByTestId } = render(
        <Card>
          <Text>Static</Text>
        </Card>
      );

      const card = getByTestId("card");
      expect(card.props.accessibilityRole).toBeUndefined();
    });

    it("does not respond to press when not pressable", () => {
      const onPress = jest.fn();
      const { getByTestId } = render(
        <Card onPress={onPress}>
          <Text>Static</Text>
        </Card>
      );

      fireEvent.press(getByTestId("card"));
      // Non-pressable card is a View, so onPress won't fire
      expect(onPress).not.toHaveBeenCalled();
    });
  });

  // -- Custom styles -------------------------------------------------------

  it("merges custom styles with defaults", () => {
    const { getByTestId } = render(
      <Card style={{ marginTop: 20 }}>
        <Text>Styled</Text>
      </Card>
    );

    const card = getByTestId("card");
    const flatStyle = Array.isArray(card.props.style)
      ? Object.assign({}, ...card.props.style)
      : card.props.style;

    expect(flatStyle.marginTop).toBe(20);
    expect(flatStyle.borderRadius).toBe(16);
  });
});
