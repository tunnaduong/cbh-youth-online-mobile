import { requireOptionalNativeModule } from "expo-modules-core";

// null on a binary built before this module existed (an OTA update can bring
// this JS to such a build) - every caller must treat that as "no native call UI".
export default requireOptionalNativeModule("CbhCallUi");
