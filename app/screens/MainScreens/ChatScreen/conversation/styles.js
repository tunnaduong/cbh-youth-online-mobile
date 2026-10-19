import { StyleSheet } from "react-native";

export const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  messagesList: {
    flex: 1,
  },
  messagesContent: {
    padding: 16,
  },
  messageContainer: {
    flexDirection: "row",
    marginBottom: 4,
    alignItems: "flex-end",
  },
  myMessageContainer: {
    justifyContent: "flex-end",
  },
  theirMessageContainer: {
    justifyContent: "flex-start",
  },
  messageAvatarWrap: {
    marginRight: 8,
  },
  messageAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
  },
  messageBubble: {
    maxWidth: "75%",
    padding: 12,
    borderRadius: 20,
    overflow: "hidden",
  },
  myMessageBubble: {
    borderBottomRightRadius: 4,
  },
  theirMessageBubble: {
    borderBottomLeftRadius: 4,
  },
  chatMessageBubble: {
    backgroundColor: "transparent",
    borderWidth: 1,
    borderRadius: 20,
  },
  imageMessageBubble: {
    padding: 0,
    overflow: "hidden",
  },
  fileMessageBubble: {
    padding: 10,
    minWidth: 180,
  },
  fileMessageContent: {
    flexDirection: "row",
    alignItems: "center",
  },
  fileIconWrapper: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(49,149,39,0.12)",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 10,
  },
  fileMessageName: {
    fontSize: 14,
    fontWeight: "600",
  },
  fileMessageSub: {
    fontSize: 11,
    marginTop: 2,
  },
  messageImage: {
    width: 200,
    height: 200,
    borderRadius: 12,
  },
  imageLoadingOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0, 0, 0, 0.3)",
    justifyContent: "center",
    alignItems: "center",
    borderRadius: 12,
  },
  uploadProgressText: {
    marginTop: 6,
    fontSize: 12,
    fontWeight: "600",
    color: "#fff",
  },
  messageText: {
    fontSize: 16,
    flexShrink: 1,
  },
  messageTime: {
    fontSize: 12,
  },
  storyReplyHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    flexWrap: "wrap",
    marginBottom: 4,
    paddingHorizontal: 16,
    marginTop: 8,
    maxWidth: "100%",
  },
  storyReplyHeaderRight: {
    justifyContent: "flex-end",
    alignSelf: "flex-end",
  },
  storyReplyText: {
    flex: 1,
    minWidth: 0,
    fontSize: 12,
    marginLeft: 4,
    fontStyle: "italic",
    flexWrap: "wrap",
    maxWidth: "100%",
  },
  storyReplyTextRight: {
    textAlign: "right",
    marginLeft: 0,
    marginRight: 4,
  },
  timeHeaderContainer: {
    alignItems: "center",
    marginVertical: 16,
    paddingHorizontal: 8,
  },
  timeHeaderText: {
    fontSize: 12,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    overflow: "hidden",
  },
  dateHeaderContainer: {
    alignItems: "center",
    marginVertical: 24,
    paddingHorizontal: 8,
  },
  dateHeaderText: {
    fontSize: 14,
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 16,
    overflow: "hidden",
    fontWeight: "600",
  },
  systemMessageContainer: {
    alignItems: "center",
    marginVertical: 8,
    paddingHorizontal: 8,
  },
  systemMessageText: {
    fontSize: 12,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 999,
    overflow: "hidden",
  },
  // Row holding the sender's name (and name icon) above their first bubble.
  senderName: {
    marginLeft: 48,
    marginBottom: 4,
    marginTop: 8,
    alignSelf: "flex-start",
    maxWidth: "80%",
  },
  senderNameText: {
    fontSize: 12,
    fontWeight: "500",
  },
  groupMessageWrapper: {
    marginTop: 8,
    marginBottom: 8,
  },
  messageFooter: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 4,
  },
  myMessageFooter: {
    justifyContent: "flex-end",
    marginRight: 4,
  },
  theirMessageFooter: {
    justifyContent: "flex-start",
    marginLeft: 4,
  },
  readStatus: {
    marginLeft: 4,
    flexDirection: "row",
    alignItems: "center",
  },
  doubleCheck: {
    flexDirection: "row",
    alignItems: "center",
  },
  checkOverlap: {
    marginRight: -6,
  },
  seenByRow: {
    marginLeft: 4,
    flexDirection: "row",
    alignItems: "center",
  },
  seenAvatar: {
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 1,
  },
  videoPlaceholder: {
    backgroundColor: "#000",
  },
  mediaErrorFallback: {
    backgroundColor: "#3a1a1a",
    justifyContent: "center",
    alignItems: "center",
    padding: 8,
  },
  mediaErrorText: {
    color: "#fff",
    fontSize: 11,
    textAlign: "center",
    marginTop: 4,
  },
  videoPlayOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.25)",
  },
  videoViewerBackdrop: {
    flex: 1,
    backgroundColor: "#000",
    justifyContent: "center",
    alignItems: "center",
  },
  seenByBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 32,
  },
  seenByBox: {
    width: "100%",
    maxHeight: "60%",
    borderRadius: 16,
    padding: 16,
  },
  seenByTitle: {
    fontSize: 16,
    fontWeight: "700",
    marginBottom: 12,
  },
  seenByParticipantRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 8,
    gap: 10,
  },
  seenByParticipantAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
  },
  seenByParticipantName: {
    fontSize: 14,
    fontWeight: "600",
  },
  seenByParticipantTime: {
    fontSize: 12,
    marginTop: 1,
  },
  videoViewerClose: {
    position: "absolute",
    right: 20,
    zIndex: 1,
    padding: 6,
  },
  imageViewerCloseButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0,0,0,0.5)",
  },
  videoViewerPlayer: {
    width: "100%",
    height: "100%",
  },
  reactionBadgeRow: {
    position: "absolute",
    bottom: -14,
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
  },
  reactionIconBtn: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  reactionPillBadge: {
    height: 24,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 6,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 2,
  },
  reactionPillEmoji: {
    fontSize: 12,
  },
  reactionPillCount: {
    fontSize: 11,
    fontWeight: "600",
  },
  reactionModalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  reactionModalContainer: {
    width: "100%",
    maxWidth: 340,
    borderRadius: 20,
    paddingVertical: 16,
    paddingHorizontal: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.18,
    shadowRadius: 16,
    elevation: 10,
  },
  reactionModalTitle: {
    fontSize: 15,
    fontWeight: "700",
    marginBottom: 14,
    textAlign: "center",
  },
  reactionModalRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 8,
    gap: 12,
  },
  reactionModalEmoji: {
    fontSize: 28,
  },
  reactionModalUser: {
    fontSize: 14,
    fontWeight: "500",
  },
  reactionModalCount: {
    fontSize: 13,
    fontWeight: "600",
  },
});

