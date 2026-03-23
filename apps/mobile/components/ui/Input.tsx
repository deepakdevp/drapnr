// =============================================================================
// Input Component
// =============================================================================

import React, { useState, useCallback } from 'react';
import { Ionicons } from '@expo/vector-icons';
import {
  View,
  TextInput,
  Text,
  Pressable,
  StyleSheet,
  type TextInputProps,
  type ViewStyle,
} from 'react-native';

import { useTheme } from '../../lib/theme';

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

export interface InputProps extends Omit<TextInputProps, 'style'> {
  label?: string;
  error?: string;
  helperText?: string;
  password?: boolean;
  search?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  containerStyle?: ViewStyle;
  inputStyle?: ViewStyle;
}

// -----------------------------------------------------------------------------
// Component
// -----------------------------------------------------------------------------

export function Input({
  label,
  error,
  helperText,
  password = false,
  search = false,
  leftIcon,
  rightIcon,
  containerStyle,
  inputStyle,
  ...rest
}: InputProps) {
  const theme = useTheme();
  const [isFocused, setIsFocused] = useState(false);
  const [isSecureVisible, setIsSecureVisible] = useState(false);

  const handleFocus = useCallback(
    (e: Parameters<NonNullable<TextInputProps['onFocus']>>[0]) => {
      setIsFocused(true);
      rest.onFocus?.(e);
    },
    [rest],
  );

  const handleBlur = useCallback(
    (e: Parameters<NonNullable<TextInputProps['onBlur']>>[0]) => {
      setIsFocused(false);
      rest.onBlur?.(e);
    },
    [rest],
  );

  const toggleSecure = useCallback(() => {
    setIsSecureVisible((v) => !v);
  }, []);

  // -- Border color logic -----------------------------------------------------

  const borderColor = error
    ? theme.colors.semantic.error
    : isFocused
      ? theme.colors.brand.primary
      : theme.colors.surface.border;

  return (
    <View style={[styles.container, containerStyle]}>
      {/* Label */}
      {label && (
        <Text
          style={[
            styles.label,
            {
              color: error ? theme.colors.semantic.error : theme.colors.text.primary,
              fontFamily: theme.fontFamilies.body,
              fontSize: theme.typography.bodySmall.fontSize,
            },
          ]}
        >
          {label}
        </Text>
      )}

      {/* Input Row */}
      <View
        style={[
          styles.inputRow,
          {
            backgroundColor: theme.colors.surface.surface,
            borderColor,
            borderRadius: theme.borderRadius.md,
            height: search ? 42 : 48,
          },
        ]}
      >
        {(leftIcon || search) && (
          <View style={styles.iconLeft}>
            {search ? (
              <Ionicons name="search" size={18} color={theme.colors.text.tertiary} />
            ) : (
              leftIcon
            )}
          </View>
        )}

        <TextInput
          style={[
            styles.input,
            {
              color: theme.colors.text.primary,
              fontFamily: theme.fontFamilies.body,
              fontSize: search ? 14 : 16,
              paddingLeft: leftIcon || search ? 0 : 14,
              paddingRight: password || rightIcon ? 0 : 14,
            },
            inputStyle,
          ]}
          placeholderTextColor={theme.colors.text.tertiary}
          secureTextEntry={password && !isSecureVisible}
          autoCapitalize={search ? 'none' : rest.autoCapitalize}
          autoCorrect={search ? false : rest.autoCorrect}
          onFocus={handleFocus}
          onBlur={handleBlur}
          {...rest}
        />

        {/* Password toggle or right icon */}
        {password && (
          <Pressable onPress={toggleSecure} style={styles.iconRight} hitSlop={8}>
            <Text style={{ color: theme.colors.text.secondary, fontSize: 14 }}>
              {isSecureVisible ? 'Hide' : 'Show'}
            </Text>
          </Pressable>
        )}

        {!password && rightIcon && <View style={styles.iconRight}>{rightIcon}</View>}
      </View>

      {/* Error / Helper */}
      {error && (
        <Text
          style={[
            styles.helperText,
            {
              color: theme.colors.semantic.error,
              fontFamily: theme.fontFamilies.body,
            },
          ]}
        >
          {error}
        </Text>
      )}
      {!error && helperText && (
        <Text
          style={[
            styles.helperText,
            {
              color: theme.colors.text.tertiary,
              fontFamily: theme.fontFamilies.body,
            },
          ]}
        >
          {helperText}
        </Text>
      )}
    </View>
  );
}

// -----------------------------------------------------------------------------
// Styles
// -----------------------------------------------------------------------------

const styles = StyleSheet.create({
  container: {
    width: '100%',
  },
  label: {
    marginBottom: 6,
    fontWeight: '500',
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
  },
  iconLeft: {
    paddingLeft: 12,
    paddingRight: 8,
  },
  iconRight: {
    paddingRight: 12,
    paddingLeft: 8,
  },
  input: {
    flex: 1,
    height: '100%',
  },
  helperText: {
    marginTop: 4,
    fontSize: 12,
  },
});
