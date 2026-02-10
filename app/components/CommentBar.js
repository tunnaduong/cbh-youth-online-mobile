import React from "react";
import {
  TouchableOpacity,
  View,
  TextInput,
  ActivityIndicator,
} from "react-native";
import Ionicons from "react-native-vector-icons/Ionicons";
import { useTheme } from "../contexts/ThemeContext";

const CommentBar = React.forwardRef(
  (
    {
      placeholderText,
      onSubmit,
      onChangeText,
      value,
      onKeyPress,
      disabled,
      editable = true,
      isSubmitting = false,
      style,
    },
    ref
  ) => {
    const { theme, isDarkMode } = useTheme();

    return (
      <View
        style={[
          {
            backgroundColor: theme.background,
            borderTopWidth: 1,
            borderTopColor: theme.border,
          },
          style,
        ]}
      >
        <View
          style={{
            padding: 10,
            paddingBottom: 5,
            width: "100%",
          }}
        >
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
            }}
          >
            <View
              style={{
                backgroundColor: isDarkMode ? "#374151" : "#DFDEDD",
                borderRadius: 50,
                padding: 7,
                paddingLeft: 13,
                flexDirection: "row",
                flex: 1,
              }}
            >
              <TextInput
                style={{
                  fontSize: 14,
                  flex: 1,
                  padding: 5,
                  color: theme.text,
                }}
                placeholder={placeholderText}
                placeholderTextColor={theme.subText}
                multiline={true}
                ref={ref}
                onChangeText={onChangeText}
                value={value}
                onKeyPress={onKeyPress}
                editable={editable}
              ></TextInput>
            </View>
            <TouchableOpacity
              style={{
                alignItems: "center",
                paddingLeft: 10,
              }}
              onPress={onSubmit}
              disabled={disabled}
            >
              {isSubmitting ? (
                <View style={{ width: 25 }}>
                  <ActivityIndicator size="small" color={theme.primary} />
                </View>
              ) : (
                <Ionicons
                  name={"send"}
                  size={25}
                  color={disabled ? (isDarkMode ? "#1e2e1c" : "#C7F0C2") : theme.primary}
                />
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    );
  }
);

export default CommentBar;
