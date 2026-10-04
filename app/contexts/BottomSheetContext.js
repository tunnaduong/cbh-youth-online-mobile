import React, { createContext, useRef, useState, useContext } from "react";
import BottomSheet, {
  BottomSheetBackdrop,
  BottomSheetView,
} from "@gorhom/bottom-sheet";
import { useTheme } from "./ThemeContext";

const BottomSheetContext = createContext();

export const useBottomSheet = () => useContext(BottomSheetContext);

export const BottomSheetProvider = ({ children }) => {
  const bottomSheetRef = useRef(null);
  const [content, setContent] = useState(null);
  // Whether the sheet is (about to be) open. The backdrop is only mounted
  // while it is: a BottomSheetBackdrop starts with pointerEvents="auto" and
  // relies on a Reanimated reaction to flip it to "none" once it sees the
  // sheet is closed. On some devices (seen on a Redmi Note 15 / Android 16)
  // that first reaction never lands, and the always-mounted, full-screen
  // backdrop then swallowed every touch in the whole app.
  const [isOpen, setIsOpen] = useState(false);
  const { theme } = useTheme();

  const snapPoints = ["90%"];

  const showBottomSheet = (sheetContent) => {
    setContent(sheetContent);
    setIsOpen(true);
    bottomSheetRef.current?.snapToIndex(0);
  };

  const hideBottomSheet = () => {
    bottomSheetRef.current?.close();
  };

  return (
    <BottomSheetContext.Provider value={{ showBottomSheet, hideBottomSheet }}>
      {children}

      {/* Absolutely positioned BottomSheet to sit above everything */}
      <BottomSheet
        ref={bottomSheetRef}
        snapPoints={snapPoints}
        index={-1}
        enablePanDownToClose
        onChange={(index) => setIsOpen(index >= 0)}
        onClose={() => setIsOpen(false)}
        backgroundStyle={{ backgroundColor: theme.cardBackground }}
        handleIndicatorStyle={{ backgroundColor: theme.border }}
        backdropComponent={
          isOpen
            ? (props) => (
                <BottomSheetBackdrop
                  {...props}
                  appearsOnIndex={0}
                  disappearsOnIndex={-1}
                  pressBehavior="close"
                />
              )
            : undefined
        }
      >
        <BottomSheetView style={{ padding: 16, paddingBottom: 50, backgroundColor: theme.cardBackground }}>
          {content}
        </BottomSheetView>
      </BottomSheet>
    </BottomSheetContext.Provider>
  );
};
