import { useEffect, useRef, type ReactNode } from "react";
import { Animated, Pressable, StyleSheet, Text, TextInput, View, type StyleProp, type TextInputProps, type ViewStyle } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { radius, useTheme } from "../theme";

type IconName = React.ComponentProps<typeof Ionicons>["name"];

export function Icon({ name, size = 20, color }: { name: IconName; size?: number; color?: string }) {
  const { c } = useTheme();
  return <Ionicons name={name} size={size} color={color ?? c.text} />;
}

export function Chip({
  label,
  on,
  onPress,
  icon,
  badge,
}: {
  label: string;
  on?: boolean;
  onPress?: () => void;
  icon?: IconName;
  badge?: number;
}) {
  const { c } = useTheme();
  const fg = on ? c.onPrimary : c.text;
  return (
    <Pressable
      onPress={onPress}
      style={[styles.chip, { backgroundColor: on ? c.primary : c.surfaceAlt }]}
      accessibilityRole="button"
      accessibilityState={{ selected: !!on }}
    >
      {icon ? <Ionicons name={icon} size={14} color={fg} /> : null}
      <Text style={{ color: fg, fontSize: 13, fontWeight: on ? "700" : "500" }}>{label}</Text>
      {badge ? (
        <View style={[styles.badge, { backgroundColor: on ? c.onPrimary : c.primary }]}>
          <Text style={{ color: on ? c.primary : c.onPrimary, fontSize: 10, fontWeight: "800" }}>{badge}</Text>
        </View>
      ) : null}
    </Pressable>
  );
}

export function Button({
  label,
  onPress,
  icon,
  variant = "primary",
  disabled,
  style,
}: {
  label: string;
  onPress: () => void;
  icon?: IconName;
  variant?: "primary" | "ghost" | "danger";
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const { c } = useTheme();
  const bg = variant === "primary" ? c.primary : variant === "danger" ? c.danger : c.surfaceAlt;
  const fg = variant === "ghost" ? c.text : c.onPrimary;
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={[styles.btn, { backgroundColor: bg, opacity: disabled ? 0.45 : 1 }, style]}
      accessibilityRole="button"
    >
      {icon ? <Ionicons name={icon} size={18} color={fg} /> : null}
      <Text style={{ color: fg, fontWeight: "700", fontSize: 15 }}>{label}</Text>
    </Pressable>
  );
}

export function Field(props: TextInputProps & { icon?: IconName }) {
  const { c } = useTheme();
  const { icon, style, ...rest } = props;
  return (
    <View style={[styles.field, { backgroundColor: c.surface, borderColor: c.border }]}>
      {icon ? <Ionicons name={icon} size={18} color={c.textMuted} /> : null}
      <TextInput
        placeholderTextColor={c.textMuted}
        style={[{ flex: 1, color: c.text, fontSize: 15, paddingVertical: 11 }, style]}
        {...rest}
      />
    </View>
  );
}

export function Card({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  const { c } = useTheme();
  return <View style={[styles.card, { backgroundColor: c.surface, borderColor: c.border }, style]}>{children}</View>;
}

export function Skeleton({ style }: { style?: StyleProp<ViewStyle> }) {
  const { c } = useTheme();
  const v = useRef(new Animated.Value(0.5)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(v, { toValue: 1, duration: 700, useNativeDriver: true }),
        Animated.timing(v, { toValue: 0.5, duration: 700, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [v]);
  return <Animated.View style={[{ backgroundColor: c.skeleton, borderRadius: radius.md, opacity: v }, style]} />;
}

export function ProgressBar({ value, color }: { value: number; color?: string }) {
  const { c } = useTheme();
  return (
    <View style={[styles.track, { backgroundColor: c.surfaceAlt }]}>
      <View style={{ width: `${Math.max(0, Math.min(1, value)) * 100}%`, height: "100%", backgroundColor: color ?? c.owned }} />
    </View>
  );
}

/**
 * Circular progress ring built from two clipped half-circles (pure JS, no native SVG dependency).
 * `value` is 0..1; children are centered inside the ring.
 */
export function ProgressRing({
  value,
  size = 120,
  thickness = 12,
  color,
  children,
}: {
  value: number;
  size?: number;
  thickness?: number;
  color?: string;
  children?: ReactNode;
}) {
  const { c } = useTheme();
  const fg = color ?? c.owned;
  const p = Math.max(0, Math.min(1, value));
  const half = size / 2;
  const circle = { position: "absolute" as const, width: size, height: size, borderRadius: half, borderWidth: thickness };
  const rightDeg = -135 + Math.min(p, 0.5) * 360;
  const leftDeg = -135 + Math.max(0, p - 0.5) * 360;
  return (
    <View style={{ width: size, height: size, alignItems: "center", justifyContent: "center" }}>
      <View style={[circle, { borderColor: c.surfaceAlt }]} />
      {p > 0.004 && (
      <View style={{ position: "absolute", left: half, top: 0, width: half, height: size, overflow: "hidden" }}>
        <View
          style={[
            circle,
            {
              left: -half,
              borderColor: "transparent",
              borderTopColor: fg,
              borderRightColor: fg,
              transform: [{ rotate: `${rightDeg}deg` }],
            },
          ]}
        />
      </View>
      )}
      {p > 0.504 && (
      <View style={{ position: "absolute", left: 0, top: 0, width: half, height: size, overflow: "hidden" }}>
        <View
          style={[
            circle,
            {
              left: 0,
              borderColor: "transparent",
              borderBottomColor: fg,
              borderLeftColor: fg,
              transform: [{ rotate: `${leftDeg}deg` }],
            },
          ]}
        />
      </View>
      )}
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  chip: { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 13, paddingVertical: 7, borderRadius: radius.pill },
  badge: { minWidth: 16, height: 16, borderRadius: 8, alignItems: "center", justifyContent: "center", paddingHorizontal: 4 },
  btn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 13, paddingHorizontal: 18, borderRadius: radius.md },
  field: { flexDirection: "row", alignItems: "center", gap: 10, borderWidth: 1, borderRadius: radius.md, paddingHorizontal: 14 },
  card: { borderWidth: StyleSheet.hairlineWidth, borderRadius: radius.lg, padding: 14 },
  track: { height: 6, borderRadius: 3, overflow: "hidden" },
});
