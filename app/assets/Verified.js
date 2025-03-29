import * as React from "react";
import Svg, { Path } from "react-native-svg";
const Verified = (props) => (
  <Svg
    xmlns="http://www.w3.org/2000/svg"
    width="1em"
    height="1em"
    fill="currentColor"
    stroke="currentColor"
    strokeWidth={0}
    aria-hidden="true"
    className="text-base leading-5 ml-0.5"
    viewBox="0 0 20 20"
    {...props}
  >
    <Path
      fillRule="evenodd"
      stroke="none"
      d="M6.267 3.455a3.066 3.066 0 0 0 1.745-.723 3.066 3.066 0 0 1 3.976 0 3.066 3.066 0 0 0 1.745.723 3.066 3.066 0 0 1 2.812 2.812c.051.643.304 1.254.723 1.745a3.066 3.066 0 0 1 0 3.976 3.066 3.066 0 0 0-.723 1.745 3.066 3.066 0 0 1-2.812 2.812 3.066 3.066 0 0 0-1.745.723 3.066 3.066 0 0 1-3.976 0 3.066 3.066 0 0 0-1.745-.723 3.066 3.066 0 0 1-2.812-2.812 3.066 3.066 0 0 0-.723-1.745 3.066 3.066 0 0 1 0-3.976 3.066 3.066 0 0 0 .723-1.745 3.066 3.066 0 0 1 2.812-2.812zm7.44 5.252a1 1 0 0 0-1.414-1.414L9 10.586 7.707 9.293a1 1 0 0 0-1.414 1.414l2 2a1 1 0 0 0 1.414 0l4-4z"
      clipRule="evenodd"
    />
  </Svg>
);
export default Verified;
