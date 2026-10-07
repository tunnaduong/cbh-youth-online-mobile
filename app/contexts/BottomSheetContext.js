import React, { createContext, useCallback, useMemo, useRef, useState, useContext } from "react";
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

  // Both only touch a ref and state setters, so they can be stable - and the
  // value with them: opening or closing the sheet re-renders this provider,
  // which used to re-render every screen that calls useBottomSheet().
  const showBottomSheet = useCallback((sheetContent) => {
    setContent(sheetContent);
    setIsOpen(true);
    bottomSheetRef.current?.snapToIndex(0);
  }, []);

  const hideBottomSheet = useCallback(() => {
    bottomSheetRef.current?.close();
  }, []);

  const value = useMemo(() => ({ showBottomSheet, hideBottomSheet }), [showBottomSheet, hideBottomSheet]);

  return (
    <BottomSheetContext.Provider value={value}>
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
