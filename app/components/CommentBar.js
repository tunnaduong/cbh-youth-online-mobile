import React from "react";
import {
  TouchableOpacity,
  View,
  TextInput,
  ActivityIndicator,
} from "react-native";
import Ionicons from "react-native-vector-icons/Ionicons";

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
    return (
      <View
        style={[
          {
            backgroundColor: "white",
            borderTopWidth: 1,
            borderTopColor: "#DFDEDD",
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
            {/* <UserAvatar
              username={username}
              style={{
                width: 40,
                height: 40,
                borderRadius: 50,
              }}
              containerStyle={{ marginRight: 10 }}
            /> */}
            <View
              style={{
                backgroundColor: "#DFDEDD",
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
                  color: "#000",
                }}
                placeholder={placeholderText}
                placeholderTextColor="#999"
                multiline={true}
                ref={ref}
                onChangeText={onChangeText}
                value={value}
                onKeyPress={onKeyPress}
                editable={editable}
              ></TextInput>
              {/* <TouchableOpacity onPress={onUpload}>
                <Ionicons
                  style={{
                    textAlign: "right",
                    paddingLeft: 5,
                    paddingRight: 5,
                  }}
                  name={"camera-outline"}
                  size={25}
                />
              </TouchableOpacity> */}
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
                  <ActivityIndicator size="small" color="#319527" />
                </View>
              ) : (
                <Ionicons
                  name={"send"}
                  size={25}
                  color={disabled ? "#C7F0C2" : "#319527"}
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
