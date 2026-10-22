import React from "react";
import { View, Text, FlatList, TouchableOpacity, Modal, TouchableWithoutFeedback } from "react-native";
import { useTranslation } from "react-i18next";
import { useTheme } from "../../../../contexts/ThemeContext";
import FastImage from "../../../../components/FastImage";
import UserNameRow from "../../../../components/profile/UserNameRow";
import { AvatarFrameWrap } from "../../../../components/profile/AvatarFrame";
import formatTime from "../../../../utils/formatTime";
import { styles } from "./styles";

// "Seen by" list of a group message (opened from the message menu).
// `participants` null = closed.
const SeenByModal = ({ participants, onClose, onOpenProfile }) => {
  const { theme } = useTheme();
  const { t } = useTranslation();

  return (
    <Modal visible={!!participants} transparent animationType="fade" onRequestClose={onClose}>
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={styles.seenByBackdrop}>
          <TouchableWithoutFeedback>
            <View style={[styles.seenByBox, { backgroundColor: theme.background }]}>
              <Text style={[styles.seenByTitle, { color: theme.text }]}>
                {t("chatConversation.seenBy", "Đã xem")}
              </Text>
              <FlatList
                data={participants || []}
                keyExtractor={(item) => String(item.id)}
                renderItem={({ item }) => {
                  const goToProfile = () => onOpenProfile(item.username);
                  return (
                    <View style={styles.seenByParticipantRow}>
                      <TouchableOpacity activeOpacity={0.6} onPress={goToProfile}>
                        <AvatarFrameWrap theme={item.profile_theme} size={32}>
                          <FastImage source={{ uri: item.avatar_url }} style={styles.seenByParticipantAvatar} />
                        </AvatarFrameWrap>
                      </TouchableOpacity>
                      <TouchableOpacity style={{ flex: 1, minWidth: 0 }} activeOpacity={0.6} onPress={goToProfile}>
                        <UserNameRow
                          name={item.profile_name || item.username}
                          theme={item.profile_theme}
                          style={[styles.seenByParticipantName, { color: theme.text }]}
                        />
                        <Text style={[styles.seenByParticipantTime, { color: theme.subText }]}>
                          {formatTime(item.last_read_at)}
                        </Text>
                      </TouchableOpacity>
                    </View>
                  );
                }}
              />
            </View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
};

export default React.memo(SeenByModal);
