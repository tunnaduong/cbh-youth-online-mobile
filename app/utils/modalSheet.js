import { Platform } from "react-native";

/**
 * Screens of the root stack that are not plain cards (the `presentation`
 * they are given in App.js). Keep in sync with App.js when a screen's
 * presentation changes.
 */
export const SCREEN_PRESENTATIONS = {
  CreatePostScreen: "modal",
  PostEditScreen: "modal",
  EditProfileScreen: "modal",
  ReportScreen: "modal",
  FeedbackScreen: "modal",
  AddGroupMembersScreen: "modal",
  CreateStory: "transparentModal",
  NewConversationScreen: "transparentModal",
  CreateGroupScreen: "transparentModal",
};

/**
 * Is this screen drawn as an iOS sheet?
 *
 * On iOS a `presentation: "modal"` screen is a sheet that starts below the
 * status bar - and so is every screen opened on top of it (a post opened
 * from the composer, for example). The safe-area inset still reports the
 * notch there, so a header that adds `insets.top` gets an empty band above
 * it. Screens in a sheet must use 0 instead; App.js does that for the whole
 * stack with this check.
 *
 * Same rule the stack uses to pick its modal screens: a modal, or a screen
 * without a presentation of its own that follows one.
 */
export function isIosSheet(navigation, route) {
  if (Platform.OS !== "ios" || !route) return false;

  const routes = navigation?.getState?.()?.routes || [];
  let afterModal = false;

  for (let index = 0; index < routes.length; index++) {
    const current = routes[index];
    const presentation = SCREEN_PRESENTATIONS[current.name];
    const modal =
      presentation === "modal" ||
      presentation === "transparentModal" ||
      (afterModal && !presentation);

    if (current.key === route.key) {
      // The first screen of a stack fills the screen whatever it is, and a
      // transparent modal is drawn over the whole screen.
      return modal && index > 0 && presentation !== "transparentModal";
    }
    afterModal = afterModal || modal;
  }

  return false;
}
