/**
 * SVG Empty State Illustrations
 *
 * Consistent, minimal SVG illustrations for various empty states.
 * Uses the app's color palette for consistency.
 */

import { cn } from "../../lib/utils";

interface IllustrationProps {
  className?: string;
  primaryColor?: string;
  secondaryColor?: string;
}

/**
 * No Data / Empty List
 */
export function NoDataIllustration({
  className,
  primaryColor = "currentColor",
  secondaryColor = "currentColor",
}: IllustrationProps) {
  return (
    <svg
      viewBox="0 0 200 160"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={cn("w-48 h-40", className)}
      aria-hidden="true"
    >
      {/* Background shapes */}
      <circle cx="100" cy="80" r="60" fill={secondaryColor} fillOpacity="0.1" />
      <circle cx="100" cy="80" r="40" fill={secondaryColor} fillOpacity="0.1" />

      {/* Empty box */}
      <rect
        x="60"
        y="50"
        width="80"
        height="60"
        rx="8"
        stroke={primaryColor}
        strokeWidth="2"
        strokeOpacity="0.5"
        fill="none"
      />

      {/* Box flap */}
      <path
        d="M60 50 L100 30 L140 50"
        stroke={primaryColor}
        strokeWidth="2"
        strokeOpacity="0.5"
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {/* Dashed lines inside */}
      <line
        x1="75"
        y1="70"
        x2="125"
        y2="70"
        stroke={primaryColor}
        strokeWidth="2"
        strokeOpacity="0.3"
        strokeDasharray="4 4"
      />
      <line
        x1="75"
        y1="85"
        x2="110"
        y2="85"
        stroke={primaryColor}
        strokeWidth="2"
        strokeOpacity="0.3"
        strokeDasharray="4 4"
      />

      {/* Floating elements */}
      <circle cx="45" cy="45" r="4" fill={primaryColor} fillOpacity="0.3" />
      <circle cx="155" cy="55" r="3" fill={primaryColor} fillOpacity="0.3" />
      <circle cx="50" cy="115" r="5" fill={primaryColor} fillOpacity="0.2" />
    </svg>
  );
}

/**
 * No Search Results
 */
export function NoSearchResultsIllustration({
  className,
  primaryColor = "currentColor",
  secondaryColor = "currentColor",
}: IllustrationProps) {
  return (
    <svg
      viewBox="0 0 200 160"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={cn("w-48 h-40", className)}
      aria-hidden="true"
    >
      {/* Background */}
      <circle cx="100" cy="80" r="50" fill={secondaryColor} fillOpacity="0.1" />

      {/* Magnifying glass */}
      <circle
        cx="90"
        cy="70"
        r="30"
        stroke={primaryColor}
        strokeWidth="3"
        strokeOpacity="0.6"
        fill="none"
      />
      <line
        x1="112"
        y1="92"
        x2="135"
        y2="115"
        stroke={primaryColor}
        strokeWidth="4"
        strokeOpacity="0.6"
        strokeLinecap="round"
      />

      {/* X inside magnifying glass */}
      <line
        x1="78"
        y1="58"
        x2="102"
        y2="82"
        stroke={primaryColor}
        strokeWidth="2"
        strokeOpacity="0.4"
        strokeLinecap="round"
      />
      <line
        x1="102"
        y1="58"
        x2="78"
        y2="82"
        stroke={primaryColor}
        strokeWidth="2"
        strokeOpacity="0.4"
        strokeLinecap="round"
      />

      {/* Question marks */}
      <text x="150" y="50" fill={primaryColor} fillOpacity="0.3" fontSize="20" fontWeight="bold">
        ?
      </text>
      <text x="45" y="110" fill={primaryColor} fillOpacity="0.2" fontSize="16" fontWeight="bold">
        ?
      </text>
    </svg>
  );
}

/**
 * No Sessions / Activity
 */
export function NoSessionsIllustration({
  className,
  primaryColor = "currentColor",
  secondaryColor = "currentColor",
}: IllustrationProps) {
  return (
    <svg
      viewBox="0 0 200 160"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={cn("w-48 h-40", className)}
      aria-hidden="true"
    >
      {/* Background */}
      <rect
        x="30"
        y="30"
        width="140"
        height="100"
        rx="12"
        fill={secondaryColor}
        fillOpacity="0.1"
      />

      {/* Window frame */}
      <rect
        x="45"
        y="45"
        width="110"
        height="70"
        rx="8"
        stroke={primaryColor}
        strokeWidth="2"
        strokeOpacity="0.5"
        fill="none"
      />

      {/* Window header */}
      <line
        x1="45"
        y1="60"
        x2="155"
        y2="60"
        stroke={primaryColor}
        strokeWidth="2"
        strokeOpacity="0.3"
      />

      {/* Window dots */}
      <circle cx="55" cy="52" r="3" fill={primaryColor} fillOpacity="0.4" />
      <circle cx="65" cy="52" r="3" fill={primaryColor} fillOpacity="0.3" />
      <circle cx="75" cy="52" r="3" fill={primaryColor} fillOpacity="0.2" />

      {/* Empty content lines */}
      <rect x="55" y="70" width="60" height="6" rx="3" fill={primaryColor} fillOpacity="0.15" />
      <rect x="55" y="82" width="40" height="6" rx="3" fill={primaryColor} fillOpacity="0.1" />
      <rect x="55" y="94" width="50" height="6" rx="3" fill={primaryColor} fillOpacity="0.1" />

      {/* Sparkle */}
      <path d="M140 75 L143 80 L140 85 L137 80 Z" fill={primaryColor} fillOpacity="0.3" />
    </svg>
  );
}

/**
 * No Team Members
 */
export function NoTeamIllustration({
  className,
  primaryColor = "currentColor",
  secondaryColor = "currentColor",
}: IllustrationProps) {
  return (
    <svg
      viewBox="0 0 200 160"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={cn("w-48 h-40", className)}
      aria-hidden="true"
    >
      {/* Background */}
      <circle cx="100" cy="80" r="55" fill={secondaryColor} fillOpacity="0.1" />

      {/* Center person (larger) */}
      <circle
        cx="100"
        cy="60"
        r="18"
        stroke={primaryColor}
        strokeWidth="2"
        strokeOpacity="0.5"
        fill="none"
      />
      <path
        d="M70 110 Q100 85 130 110"
        stroke={primaryColor}
        strokeWidth="2"
        strokeOpacity="0.5"
        fill="none"
        strokeLinecap="round"
      />

      {/* Left person (faded) */}
      <circle
        cx="50"
        cy="70"
        r="12"
        stroke={primaryColor}
        strokeWidth="1.5"
        strokeOpacity="0.25"
        strokeDasharray="3 3"
        fill="none"
      />

      {/* Right person (faded) */}
      <circle
        cx="150"
        cy="70"
        r="12"
        stroke={primaryColor}
        strokeWidth="1.5"
        strokeOpacity="0.25"
        strokeDasharray="3 3"
        fill="none"
      />

      {/* Plus sign */}
      <circle cx="165" cy="45" r="10" fill={primaryColor} fillOpacity="0.2" />
      <line
        x1="165"
        y1="40"
        x2="165"
        y2="50"
        stroke={primaryColor}
        strokeWidth="2"
        strokeOpacity="0.5"
        strokeLinecap="round"
      />
      <line
        x1="160"
        y1="45"
        x2="170"
        y2="45"
        stroke={primaryColor}
        strokeWidth="2"
        strokeOpacity="0.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

/**
 * No Notifications
 */
export function NoNotificationsIllustration({
  className,
  primaryColor = "currentColor",
  secondaryColor = "currentColor",
}: IllustrationProps) {
  return (
    <svg
      viewBox="0 0 200 160"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={cn("w-48 h-40", className)}
      aria-hidden="true"
    >
      {/* Background */}
      <circle cx="100" cy="80" r="50" fill={secondaryColor} fillOpacity="0.1" />

      {/* Bell */}
      <path
        d="M100 35 C80 35 70 55 70 75 L70 95 L60 105 L140 105 L130 95 L130 75 C130 55 120 35 100 35"
        stroke={primaryColor}
        strokeWidth="2"
        strokeOpacity="0.5"
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {/* Bell clapper */}
      <circle cx="100" cy="115" r="8" fill={primaryColor} fillOpacity="0.3" />

      {/* Bell top */}
      <circle cx="100" cy="35" r="4" fill={primaryColor} fillOpacity="0.4" />

      {/* Z's for sleeping/quiet */}
      <text x="140" y="50" fill={primaryColor} fillOpacity="0.4" fontSize="14" fontWeight="bold">
        z
      </text>
      <text x="150" y="40" fill={primaryColor} fillOpacity="0.3" fontSize="12" fontWeight="bold">
        z
      </text>
      <text x="158" y="32" fill={primaryColor} fillOpacity="0.2" fontSize="10" fontWeight="bold">
        z
      </text>
    </svg>
  );
}

/**
 * Error State
 */
export function ErrorIllustration({
  className,
  primaryColor = "currentColor",
  secondaryColor = "currentColor",
}: IllustrationProps) {
  return (
    <svg
      viewBox="0 0 200 160"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={cn("w-48 h-40", className)}
      aria-hidden="true"
    >
      {/* Background */}
      <circle cx="100" cy="80" r="55" fill={secondaryColor} fillOpacity="0.1" />

      {/* Warning triangle */}
      <path
        d="M100 30 L150 120 L50 120 Z"
        stroke={primaryColor}
        strokeWidth="3"
        strokeOpacity="0.5"
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {/* Exclamation mark */}
      <line
        x1="100"
        y1="55"
        x2="100"
        y2="85"
        stroke={primaryColor}
        strokeWidth="4"
        strokeOpacity="0.6"
        strokeLinecap="round"
      />
      <circle cx="100" cy="100" r="4" fill={primaryColor} fillOpacity="0.6" />

      {/* Sparks */}
      <line
        x1="45"
        y1="50"
        x2="35"
        y2="40"
        stroke={primaryColor}
        strokeWidth="2"
        strokeOpacity="0.3"
        strokeLinecap="round"
      />
      <line
        x1="155"
        y1="50"
        x2="165"
        y2="40"
        stroke={primaryColor}
        strokeWidth="2"
        strokeOpacity="0.3"
        strokeLinecap="round"
      />
    </svg>
  );
}

/**
 * Success / Complete State
 */
export function SuccessIllustration({
  className,
  primaryColor = "currentColor",
  secondaryColor = "currentColor",
}: IllustrationProps) {
  return (
    <svg
      viewBox="0 0 200 160"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={cn("w-48 h-40", className)}
      aria-hidden="true"
    >
      {/* Background circles */}
      <circle cx="100" cy="80" r="55" fill={secondaryColor} fillOpacity="0.1" />
      <circle cx="100" cy="80" r="40" fill={secondaryColor} fillOpacity="0.1" />

      {/* Checkmark circle */}
      <circle
        cx="100"
        cy="80"
        r="35"
        stroke={primaryColor}
        strokeWidth="3"
        strokeOpacity="0.5"
        fill="none"
      />

      {/* Checkmark */}
      <path
        d="M80 80 L95 95 L125 65"
        stroke={primaryColor}
        strokeWidth="4"
        strokeOpacity="0.7"
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {/* Celebration sparkles */}
      <circle cx="55" cy="45" r="3" fill={primaryColor} fillOpacity="0.4" />
      <circle cx="145" cy="50" r="4" fill={primaryColor} fillOpacity="0.3" />
      <circle cx="50" cy="110" r="3" fill={primaryColor} fillOpacity="0.3" />
      <circle cx="150" cy="115" r="3" fill={primaryColor} fillOpacity="0.2" />

      {/* Stars */}
      <path d="M160 70 L163 75 L160 80 L157 75 Z" fill={primaryColor} fillOpacity="0.4" />
      <path d="M40 85 L42 88 L40 91 L38 88 Z" fill={primaryColor} fillOpacity="0.3" />
    </svg>
  );
}

/**
 * No Agents / AI
 */
export function NoAgentsIllustration({
  className,
  primaryColor = "currentColor",
  secondaryColor = "currentColor",
}: IllustrationProps) {
  return (
    <svg
      viewBox="0 0 200 160"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={cn("w-48 h-40", className)}
      aria-hidden="true"
    >
      {/* Background */}
      <rect x="40" y="35" width="120" height="90" rx="16" fill={secondaryColor} fillOpacity="0.1" />

      {/* Robot head */}
      <rect
        x="65"
        y="45"
        width="70"
        height="55"
        rx="12"
        stroke={primaryColor}
        strokeWidth="2"
        strokeOpacity="0.5"
        fill="none"
      />

      {/* Eyes */}
      <circle cx="85" cy="70" r="8" fill={primaryColor} fillOpacity="0.3" />
      <circle cx="115" cy="70" r="8" fill={primaryColor} fillOpacity="0.3" />

      {/* Sleeping eyes (lines) */}
      <line
        x1="80"
        y1="70"
        x2="90"
        y2="70"
        stroke={primaryColor}
        strokeWidth="2"
        strokeOpacity="0.5"
        strokeLinecap="round"
      />
      <line
        x1="110"
        y1="70"
        x2="120"
        y2="70"
        stroke={primaryColor}
        strokeWidth="2"
        strokeOpacity="0.5"
        strokeLinecap="round"
      />

      {/* Mouth */}
      <line
        x1="90"
        y1="88"
        x2="110"
        y2="88"
        stroke={primaryColor}
        strokeWidth="2"
        strokeOpacity="0.4"
        strokeLinecap="round"
      />

      {/* Antenna */}
      <line
        x1="100"
        y1="45"
        x2="100"
        y2="30"
        stroke={primaryColor}
        strokeWidth="2"
        strokeOpacity="0.4"
        strokeLinecap="round"
      />
      <circle cx="100" cy="25" r="5" fill={primaryColor} fillOpacity="0.3" />

      {/* Ears */}
      <rect x="55" y="60" width="10" height="20" rx="3" fill={primaryColor} fillOpacity="0.2" />
      <rect x="135" y="60" width="10" height="20" rx="3" fill={primaryColor} fillOpacity="0.2" />

      {/* Z's */}
      <text x="145" y="45" fill={primaryColor} fillOpacity="0.3" fontSize="12" fontWeight="bold">
        z
      </text>
      <text x="152" y="38" fill={primaryColor} fillOpacity="0.2" fontSize="10" fontWeight="bold">
        z
      </text>
    </svg>
  );
}

// Export all illustrations as a map for easy access
export const EmptyStateIllustrations = {
  noData: NoDataIllustration,
  noSearchResults: NoSearchResultsIllustration,
  noSessions: NoSessionsIllustration,
  noTeam: NoTeamIllustration,
  noNotifications: NoNotificationsIllustration,
  error: ErrorIllustration,
  success: SuccessIllustration,
  noAgents: NoAgentsIllustration,
};

export type IllustrationType = keyof typeof EmptyStateIllustrations;

export default EmptyStateIllustrations;
