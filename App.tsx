import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleProp,
  StyleSheet,
  Text,
  TextInput,
  useColorScheme,
  View,
  ViewStyle
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import axios from "axios";
import dayjs from "dayjs";
import { BlurView } from "expo-blur";
import Svg, { Line, Rect, Text as SvgText } from "react-native-svg";

import {
  AttendanceRecord,
  buildAttendanceRecords,
  buildDailyAverage,
  buildMonthlyAverage,
  calculateSummary,
  formatHours,
  getMonthsBetween,
  getRecentMonths,
  isInsufficientHours,
  nextMonth
} from "./src/lib/attendance";

const API_URL = Platform.OS === "web"
  ? "http://localhost:8787/attendance"
  : "https://im.360teams.com/api/qfin-api/securityapi/attendance/query/detail";
const STORAGE_EMCODE = "attendance.emCode";
const STORAGE_AUTH = "attendance.authorization";
const STORAGE_YEAR_RECORDS = "attendance.year.records";
const STORAGE_YEAR_FETCHED_AT = "attendance.year.fetchedAt";
const STORAGE_YEAR_EMCODE = "attendance.year.emCode";
const STORAGE_THRESHOLD = "attendance.threshold";
const DEFAULT_EMCODE = "JR1001913";
const DEFAULT_AUTH = "97611d5d17f4447da7e806bb9697b64a";
const DEFAULT_THRESHOLD = "10.5";

type ChartMode = "year" | "month";
type Theme = {
  background: string;
  blobPrimary: string;
  blobSecondary: string;
  card: string;
  cardBorder: string;
  textPrimary: string;
  textSecondary: string;
  accent: string;
  toggleBackground: string;
  toggleActive: string;
  toggleText: string;
  toggleTextActive: string;
  inputBorder: string;
  inputBackground: string;
  mutedSurface: string;
  iconBackground: string;
  iconBorder: string;
  success: string;
  danger: string;
  warning: string;
  recordTagText: string;
  recordTagBackground: string;
  missingBackground: string;
  insufficientBackground: string;
  chartLine: string;
};
type TabKey = "home" | "settings";
type PickerTarget = "start" | "end" | "single" | null;

const LIGHT_THEME: Theme = {
  background: "#f2f2f7",
  blobPrimary: "rgba(0,122,255,0.18)",
  blobSecondary: "rgba(52,199,89,0.18)",
  card: "rgba(255,255,255,0.72)",
  cardBorder: "rgba(209,209,214,0.8)",
  textPrimary: "#1c1c1e",
  textSecondary: "#8e8e93",
  accent: "#007aff",
  toggleBackground: "#e5e5ea",
  toggleActive: "#ffffff",
  toggleText: "#6b7280",
  toggleTextActive: "#1c1c1e",
  inputBorder: "#d1d1d6",
  inputBackground: "rgba(255,255,255,0.9)",
  mutedSurface: "#f2f2f7",
  iconBackground: "rgba(255,255,255,0.95)",
  iconBorder: "#d1d1d6",
  success: "#34c759",
  danger: "#ff3b30",
  warning: "#ff9500",
  recordTagText: "#34c759",
  recordTagBackground: "rgba(52,199,89,0.18)",
  missingBackground: "rgba(255,59,48,0.12)",
  insufficientBackground: "rgba(255,149,0,0.12)",
  chartLine: "#8e8e93"
};

const DARK_THEME: Theme = {
  background: "#000000",
  blobPrimary: "rgba(10,132,255,0.28)",
  blobSecondary: "rgba(48,209,88,0.22)",
  card: "rgba(28,28,30,0.72)",
  cardBorder: "rgba(255,255,255,0.08)",
  textPrimary: "#f2f2f7",
  textSecondary: "#a1a1aa",
  accent: "#0a84ff",
  toggleBackground: "rgba(44,44,46,0.9)",
  toggleActive: "rgba(255,255,255,0.12)",
  toggleText: "#c7c7cc",
  toggleTextActive: "#f2f2f7",
  inputBorder: "rgba(99,99,102,0.7)",
  inputBackground: "rgba(44,44,46,0.9)",
  mutedSurface: "rgba(44,44,46,0.9)",
  iconBackground: "rgba(44,44,46,0.9)",
  iconBorder: "rgba(99,99,102,0.7)",
  success: "#30d158",
  danger: "#ff453a",
  warning: "#ff9f0a",
  recordTagText: "#30d158",
  recordTagBackground: "rgba(48,209,88,0.2)",
  missingBackground: "rgba(255,69,58,0.2)",
  insufficientBackground: "rgba(255,159,10,0.2)",
  chartLine: "#8e8e93"
};

function getTheme(isDark: boolean): Theme {
  return isDark ? DARK_THEME : LIGHT_THEME;
}

type ApiResponse = {
  code?: number;
  data?: {
    calendarList?: Array<{
      attDate: string;
      isrest: number;
      firstDate?: string | null;
      endDate?: string | null;
      exp?: string | null;
      resultList?: Array<string | number | null>;
    }>;
  };
  message?: string;
};

type ChartDatum = {
  label: string;
  value: number;
  color: string;
  isHalfDay?: boolean;
};

type ChartProps = {
  data: ChartDatum[];
  threshold: number;
  height?: number;
  labelColor: string;
  thresholdColor: string;
  halfDayColor: string;
  containerStyle?: StyleProp<ViewStyle>;
};

function BarChart({
  data,
  threshold,
  height = 180,
  labelColor,
  thresholdColor,
  halfDayColor,
  containerStyle
}: ChartProps) {
  const [width, setWidth] = useState(0);
  const barGap = 8;
  const barWidth = data.length > 20 ? 24 : 32;
  const paddingTop = 12;
  const paddingBottom = 28;
  const paddingHorizontal = 12;
  const plotHeight = height - paddingTop - paddingBottom;
  const maxValue = Math.max(
    threshold,
    ...data.map((point) => point.value),
    1
  );
  const totalBarsWidth =
    data.length * barWidth + Math.max(data.length - 1, 0) * barGap;
  const svgWidth = Math.max(
    width,
    totalBarsWidth + paddingHorizontal * 2
  );
  const labelEvery = data.length <= 12 ? 1 : Math.ceil(data.length / 6);

  return (
    <View
      style={containerStyle}
      onLayout={(event) => setWidth(event.nativeEvent.layout.width)}
    >
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <Svg width={svgWidth} height={height}>
          <Line
            x1={paddingHorizontal}
            x2={svgWidth - paddingHorizontal}
            y1={paddingTop + plotHeight - (threshold / maxValue) * plotHeight}
            y2={paddingTop + plotHeight - (threshold / maxValue) * plotHeight}
            stroke={thresholdColor}
            strokeWidth={1}
            strokeDasharray="4 4"
          />
          {data.map((point, index) => {
            const barHeight = (point.value / maxValue) * plotHeight;
            const x = paddingHorizontal + index * (barWidth + barGap);
            const y = paddingTop + plotHeight - barHeight;
            const showLabel =
              index % labelEvery === 0 || index === data.length - 1;

            return (
              <React.Fragment key={`${point.label}-${index}`}>
                <Rect
                  x={x}
                  y={y}
                  width={barWidth}
                  height={barHeight}
                  rx={4}
                  fill={point.color}
                />
                {showLabel ? (
                  <SvgText
                    x={x + barWidth / 2}
                    y={height - 8}
                    fill={labelColor}
                    fontSize={10}
                    textAnchor="middle"
                  >
                    {point.label}
                  </SvgText>
                ) : null}
                {point.isHalfDay ? (
                  <SvgText
                    x={x + barWidth / 2}
                    y={Math.max(y - 4, 10)}
                    fill={halfDayColor}
                    fontSize={8}
                    textAnchor="middle"
                  >
                    半天有效工时
                  </SvgText>
                ) : null}
              </React.Fragment>
            );
          })}
        </Svg>
      </ScrollView>
    </View>
  );
}

export default function App() {
  const [emCode, setEmCode] = useState("");
  const [authorization, setAuthorization] = useState("");
  const [selectedMonth, setSelectedMonth] = useState(
    dayjs().format("YYYY-MM")
  );
  const [rangeStart, setRangeStart] = useState(
    dayjs().subtract(11, "month").format("YYYY-MM")
  );
  const [rangeEnd, setRangeEnd] = useState(dayjs().format("YYYY-MM"));
  const [rangeError, setRangeError] = useState<string | null>(null);
  const [yearRecords, setYearRecords] = useState<AttendanceRecord[] | null>(
    null
  );
  const [yearFetchedAt, setYearFetchedAt] = useState<string | null>(null);
  const [yearLoading, setYearLoading] = useState(false);
  const [yearError, setYearError] = useState<string | null>(null);
  const [thresholdInput, setThresholdInput] = useState(DEFAULT_THRESHOLD);
  const [chartMode, setChartMode] = useState<ChartMode>("year");
  const [activeTab, setActiveTab] = useState<TabKey>("home");
  const [pickerTarget, setPickerTarget] = useState<PickerTarget>(null);
  const [hydrated, setHydrated] = useState(false);
  const colorScheme = useColorScheme();
  const isIOS = Platform.OS === "ios";
  const isDark = isIOS && colorScheme === "dark";
  const theme = useMemo(() => getTheme(isDark), [isDark]);
  const styles = useMemo(() => createStyles(theme), [theme]);

  useEffect(() => {
    const hydrate = async () => {
      const [savedEmCode, savedAuth] = await Promise.all([
        AsyncStorage.getItem(STORAGE_EMCODE),
        AsyncStorage.getItem(STORAGE_AUTH)
      ]);
      if (savedEmCode) {
        setEmCode(savedEmCode);
      } else {
        setEmCode(DEFAULT_EMCODE);
      }
      if (savedAuth) {
        setAuthorization(savedAuth);
      } else {
        setAuthorization(DEFAULT_AUTH);
      }
      setHydrated(true);
    };
    hydrate();
  }, []);

  useEffect(() => {
    if (!hydrated) {
      return;
    }
    AsyncStorage.setItem(STORAGE_EMCODE, emCode);
  }, [emCode, hydrated]);

  useEffect(() => {
    if (!hydrated) {
      return;
    }
    AsyncStorage.setItem(STORAGE_AUTH, authorization);
  }, [authorization, hydrated]);

  useEffect(() => {
    if (!hydrated) {
      return;
    }
    const loadYearCache = async () => {
      const [recordsJson, fetchedAt, cachedEmCode, cachedThreshold] =
        await Promise.all([
          AsyncStorage.getItem(STORAGE_YEAR_RECORDS),
          AsyncStorage.getItem(STORAGE_YEAR_FETCHED_AT),
          AsyncStorage.getItem(STORAGE_YEAR_EMCODE),
          AsyncStorage.getItem(STORAGE_THRESHOLD)
        ]);

      if (cachedThreshold) {
        setThresholdInput(cachedThreshold);
      }

      if (!cachedEmCode || cachedEmCode !== emCode) {
        setYearRecords(null);
        setYearFetchedAt(null);
        return;
      }

      if (recordsJson) {
        try {
          const parsed = JSON.parse(recordsJson) as AttendanceRecord[];
          setYearRecords(parsed);
          setYearFetchedAt(fetchedAt ?? null);
        } catch {
          setYearRecords(null);
          setYearFetchedAt(null);
        }
      } else {
        setYearRecords(null);
        setYearFetchedAt(null);
      }
    };

    loadYearCache();
  }, [emCode, hydrated]);

  useEffect(() => {
    if (!hydrated) {
      return;
    }
    AsyncStorage.setItem(STORAGE_THRESHOLD, thresholdInput);
  }, [hydrated, thresholdInput]);

  const thresholdValue = useMemo(() => {
    const parsed = Number.parseFloat(thresholdInput);
    return Number.isFinite(parsed) && parsed > 0
      ? parsed
      : Number.parseFloat(DEFAULT_THRESHOLD);
  }, [thresholdInput]);
  const recentMonths = useMemo(() => getRecentMonths(12), []);
  const rangeMonths = useMemo(
    () => getMonthsBetween(rangeStart, rangeEnd),
    [rangeEnd, rangeStart]
  );
  const monthChartData = useMemo(() => {
    if (!yearRecords || rangeMonths.length === 0) {
      return [];
    }
    return buildMonthlyAverage(yearRecords, rangeMonths).map((point) => ({
      label: point.label.slice(2),
      value: point.value,
      color: point.value >= thresholdValue ? theme.success : theme.danger
    }));
  }, [rangeMonths, thresholdValue, theme, yearRecords]);
  const dayChartData = useMemo(() => {
    if (!yearRecords) {
      return [];
    }
    return buildDailyAverage(yearRecords, selectedMonth).map((point) => ({
      label: point.label,
      value: point.value,
      color: point.value >= thresholdValue ? theme.success : theme.danger,
      isHalfDay: point.isHalfDay
    }));
  }, [selectedMonth, thresholdValue, theme, yearRecords]);

  const filteredRecords = useMemo(() => {
    if (!yearRecords) {
      return [];
    }
    if (chartMode === "year") {
      return yearRecords.filter((record) =>
        rangeMonths.includes(record.month)
      );
    }
    return yearRecords.filter((record) => record.month === selectedMonth);
  }, [chartMode, rangeMonths, selectedMonth, yearRecords]);
  const summary = useMemo(
    () => calculateSummary(filteredRecords),
    [filteredRecords]
  );

  const monthOptions = useMemo(
    () => [...recentMonths].reverse(),
    [recentMonths]
  );
  const pickerTitle =
    pickerTarget === "start"
      ? "选择起始年月"
      : pickerTarget === "end"
      ? "选择结束年月"
      : "选择月份";
  const handlePickMonth = useCallback(
    (value: string) => {
      if (!pickerTarget) {
        return;
      }
      if (pickerTarget === "single") {
        setSelectedMonth(value);
        setPickerTarget(null);
        return;
      }
      if (pickerTarget === "start") {
        if (value > rangeEnd) {
          setRangeError("结束年月不能早于起始年月");
          return;
        }
        setRangeStart(value);
        setRangeError(null);
        setPickerTarget(null);
        return;
      }
      if (value < rangeStart) {
        setRangeError("结束年月不能早于起始年月");
        return;
      }
      setRangeEnd(value);
      setRangeError(null);
      setPickerTarget(null);
    },
    [pickerTarget, rangeEnd, rangeStart]
  );

  const getAttendanceData = useCallback(
    async (cycle: string) => {
      const headers =
        Platform.OS === "web"
          ? { Authorization: authorization }
          : {
              "User-Agent": "Mozilla/5.0",
              AppKey: "360teams",
              Authorization: authorization
            };
      const response = await axios.get<ApiResponse>(API_URL, {
        headers,
        params: {
          emCode,
          attDate: "",
          cycle
        }
      });

      const payload = response.data;
      if (!payload || payload.code !== 0) {
        const message = payload?.message ?? "未知错误";
        throw new Error(`${cycle} 请求失败：${message}`);
      }
      return payload.data?.calendarList ?? [];
    },
    [authorization, emCode]
  );

  const handleFetchYear = useCallback(async () => {
    if (!emCode.trim() || !authorization.trim()) {
      setYearError("请先填写 emCode 与 Authorization。");
      return;
    }

    setYearLoading(true);
    setYearError(null);

    try {
      const aggregated: AttendanceRecord[] = [];
      for (const cycle of recentMonths) {
        const current = await getAttendanceData(cycle);
        const following = await getAttendanceData(nextMonth(cycle));
        const merged = [...current, ...following];
        aggregated.push(...buildAttendanceRecords(merged, cycle));
      }

      const fetchedAt = dayjs().format("YYYY-MM-DD hh:mm:ss");
      setYearRecords(aggregated);
      setYearFetchedAt(fetchedAt);
      await AsyncStorage.multiSet([
        [STORAGE_YEAR_RECORDS, JSON.stringify(aggregated)],
        [STORAGE_YEAR_FETCHED_AT, fetchedAt],
        [STORAGE_YEAR_EMCODE, emCode]
      ]);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "近一年数据拉取失败。";
      setYearError(message);
    } finally {
      setYearLoading(false);
    }
  }, [authorization, emCode, getAttendanceData, recentMonths]);

  const renderItem = useCallback(
    ({ item }: { item: AttendanceRecord }) => {
      const isMissing = item.missingClock;
      const isInsufficient = isInsufficientHours(item);
      const highlightStyle = isMissing
        ? styles.missing
        : isInsufficient
        ? styles.insufficient
        : null;

      return (
        <View style={[styles.recordCard, highlightStyle]}>
          <View style={styles.recordRow}>
            <Text style={styles.recordDate}>{item.date}</Text>
            <Text style={styles.recordHours}>
              {formatHours(item.workHours)}
            </Text>
          </View>
          <View style={styles.recordRow}>
            <Text style={styles.recordLabel}>
              上班: {item.firstDate ?? "--"}
            </Text>
            <Text style={styles.recordLabel}>
              下班: {item.endDate ?? "--"}
            </Text>
          </View>
          <View style={styles.recordRow}>
            <Text style={styles.recordLabel}>备注: {item.remark ?? "--"}</Text>
            <Text style={styles.recordLabel}>备注2: {item.remark2 ?? "--"}</Text>
          </View>
          {item.isRest !== 0 ? (
            <View style={styles.recordTagRow}>
              <Text style={styles.recordTag}>假期</Text>
            </View>
          ) : null}
        </View>
      );
    },
    [styles]
  );

  const summaryAvgText =
    summary.avgHours === null ? "异常" : formatHours(summary.avgHours);
  const chartData = chartMode === "year" ? monthChartData : dayChartData;
  const chartTitle = chartMode === "year" ? "年" : "月";
  const chartEmptyText = yearRecords ? "暂无数据" : "待拉取";

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.backgroundLayer} pointerEvents="none">
        <View style={[styles.backgroundBlob, styles.blobOne]} />
        <View style={[styles.backgroundBlob, styles.blobTwo]} />
      </View>
      {isIOS ? (
        <BlurView
          intensity={isDark ? 35 : 25}
          tint={isDark ? "dark" : "light"}
          style={styles.glassOverlay}
          pointerEvents="none"
        />
      ) : null}
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        {activeTab === "home" ? (
          <FlatList
            data={filteredRecords}
            keyExtractor={(item) => item.date}
            renderItem={renderItem}
            ListHeaderComponent={
              <View style={styles.header}>
                <Text style={styles.title}>Teams 工时统计</Text>
                <Text style={styles.subTitle}>
                  当前工号：{emCode ? emCode : "--"}
                </Text>

                <View style={styles.topActions}>
                  <Pressable
                    style={styles.primaryButton}
                    onPress={handleFetchYear}
                    disabled={yearLoading}
                  >
                    <Text style={styles.primaryButtonText}>
                      {yearLoading ? "拉取中..." : "近一年拉取"}
                    </Text>
                  </Pressable>
                  {yearFetchedAt ? (
                    <Text style={styles.timestampText}>
                      当前使用数据拉取时间为{yearFetchedAt}
                    </Text>
                  ) : null}
                  {yearError ? (
                    <Text style={styles.errorText}>{yearError}</Text>
                  ) : null}
                </View>

                <View style={styles.section}>
                  <View style={styles.sectionHeader}>
                    <Text style={styles.sectionTitle}>图表</Text>
                    <Text style={styles.sectionHint}>{chartTitle}</Text>
                  </View>
                  <View style={styles.chartToggleRow}>
                    <Pressable
                      style={[
                        styles.toggleButton,
                        styles.toggleButtonDivider,
                        chartMode === "year" && styles.toggleButtonActive
                      ]}
                      onPress={() => setChartMode("year")}
                    >
                      <Text
                        style={[
                          styles.toggleButtonText,
                          chartMode === "year" && styles.toggleButtonTextActive
                        ]}
                      >
                        年
                      </Text>
                    </Pressable>
                    <Pressable
                      style={[
                        styles.toggleButton,
                        chartMode === "month" && styles.toggleButtonActive
                      ]}
                      onPress={() => setChartMode("month")}
                    >
                      <Text
                        style={[
                          styles.toggleButtonText,
                          chartMode === "month" && styles.toggleButtonTextActive
                        ]}
                      >
                        月
                      </Text>
                    </Pressable>
                  </View>
                  {chartMode === "year" ? (
                    <View>
                      <View style={styles.rangeRow}>
                        <Pressable
                          style={styles.rangeButton}
                          onPress={() => setPickerTarget("start")}
                        >
                          <Text style={styles.rangeLabel}>起始年月</Text>
                          <Text style={styles.rangeValue}>{rangeStart}</Text>
                        </Pressable>
                        <Pressable
                          style={styles.rangeButton}
                          onPress={() => setPickerTarget("end")}
                        >
                          <Text style={styles.rangeLabel}>结束年月</Text>
                          <Text style={styles.rangeValue}>{rangeEnd}</Text>
                        </Pressable>
                      </View>
                      {rangeError ? (
                        <Text style={styles.errorText}>{rangeError}</Text>
                      ) : null}
                      <View style={styles.summaryRow}>
                        <View style={styles.summaryCard}>
                          <Text style={styles.summaryLabel}>平均工时</Text>
                          <Text style={styles.summaryValue}>
                            {summaryAvgText}
                          </Text>
                        </View>
                        <View style={styles.summaryCard}>
                          <Text style={styles.summaryLabel}>有效工作日</Text>
                          <Text style={styles.summaryValue}>
                            {summary.validDays}
                          </Text>
                        </View>
                        <View style={styles.summaryCard}>
                          <Text style={styles.summaryLabel}>总有效工时</Text>
                          <Text style={styles.summaryValue}>
                            {formatHours(summary.validHours)}
                          </Text>
                        </View>
                      </View>
                      <View style={styles.thresholdRow}>
                        <Text style={styles.thresholdLabel}>警戒线阈值</Text>
                        <TextInput
                          style={styles.thresholdInput}
                          value={thresholdInput}
                          onChangeText={setThresholdInput}
                          keyboardType="numeric"
                        />
                      </View>
                      {chartData.length > 0 ? (
                        <BarChart
                          data={chartData}
                          threshold={thresholdValue}
                          labelColor={theme.textSecondary}
                          thresholdColor={theme.chartLine}
                          halfDayColor={theme.textPrimary}
                          containerStyle={styles.chartContainer}
                        />
                      ) : (
                        <View style={styles.chartEmpty}>
                          <Text style={styles.emptyText}>
                            {chartEmptyText}
                          </Text>
                        </View>
                      )}
                    </View>
                  ) : (
                    <View>
                      <Pressable
                        style={styles.monthPickerButton}
                        onPress={() => setPickerTarget("single")}
                      >
                        <Text style={styles.rangeLabel}>月份</Text>
                        <Text style={styles.monthPickerText}>
                          {selectedMonth}
                        </Text>
                      </Pressable>
                      <View style={styles.summaryRow}>
                        <View style={styles.summaryCard}>
                          <Text style={styles.summaryLabel}>平均工时</Text>
                          <Text style={styles.summaryValue}>
                            {summaryAvgText}
                          </Text>
                        </View>
                        <View style={styles.summaryCard}>
                          <Text style={styles.summaryLabel}>有效工作日</Text>
                          <Text style={styles.summaryValue}>
                            {summary.validDays}
                          </Text>
                        </View>
                        <View style={styles.summaryCard}>
                          <Text style={styles.summaryLabel}>总有效工时</Text>
                          <Text style={styles.summaryValue}>
                            {formatHours(summary.validHours)}
                          </Text>
                        </View>
                      </View>
                      <View style={styles.thresholdRow}>
                        <Text style={styles.thresholdLabel}>警戒线阈值</Text>
                        <TextInput
                          style={styles.thresholdInput}
                          value={thresholdInput}
                          onChangeText={setThresholdInput}
                          keyboardType="numeric"
                        />
                      </View>
                      {chartData.length > 0 ? (
                        <BarChart
                          data={chartData}
                          threshold={thresholdValue}
                          labelColor={theme.textSecondary}
                          thresholdColor={theme.chartLine}
                          halfDayColor={theme.textPrimary}
                          containerStyle={styles.chartContainer}
                        />
                      ) : (
                        <View style={styles.chartEmpty}>
                          <Text style={styles.emptyText}>
                            {chartEmptyText}
                          </Text>
                        </View>
                      )}
                    </View>
                  )}
                </View>

                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>明细</Text>
                </View>
              </View>
            }
            ListEmptyComponent={
              yearLoading ? (
                <View style={styles.emptyState}>
                  <ActivityIndicator size="small" color={theme.textPrimary} />
                  <Text style={styles.emptyText}>正在加载...</Text>
                </View>
              ) : (
                <View style={styles.emptyState}>
                  <Text style={styles.emptyText}>
                    {yearRecords ? "暂无记录" : "待拉取"}
                  </Text>
                </View>
              )
            }
            contentContainerStyle={styles.listContent}
            keyboardShouldPersistTaps="handled"
          />
        ) : (
          <ScrollView
            contentContainerStyle={styles.settingsContent}
            keyboardShouldPersistTaps="handled"
          >
            <View style={styles.header}>
              <Text style={styles.title}>设置</Text>
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>登录信息</Text>
                <Text style={styles.inputLabel}>工号</Text>
                <TextInput
                  style={styles.input}
                  value={emCode}
                  onChangeText={setEmCode}
                  placeholder="输入工号"
                  placeholderTextColor={theme.textSecondary}
                />
                <Text style={styles.inputLabel}>鉴权</Text>
                <TextInput
                  style={styles.input}
                  value={authorization}
                  onChangeText={setAuthorization}
                  placeholder="输入鉴权"
                  placeholderTextColor={theme.textSecondary}
                />
              </View>
            </View>
          </ScrollView>
        )}
      </KeyboardAvoidingView>
      <View style={styles.bottomNav}>
        <Pressable
          style={[
            styles.tabButton,
            activeTab === "home" && styles.tabButtonActive
          ]}
          onPress={() => setActiveTab("home")}
        >
          <Text
            style={[
              styles.tabText,
              activeTab === "home" && styles.tabTextActive
            ]}
          >
            首页
          </Text>
        </Pressable>
        <Pressable
          style={[
            styles.tabButton,
            activeTab === "settings" && styles.tabButtonActive
          ]}
          onPress={() => setActiveTab("settings")}
        >
          <Text
            style={[
              styles.tabText,
              activeTab === "settings" && styles.tabTextActive
            ]}
          >
            设置
          </Text>
        </Pressable>
      </View>
      <Modal
        visible={pickerTarget !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setPickerTarget(null)}
      >
        <Pressable
          style={styles.modalBackdrop}
          onPress={() => setPickerTarget(null)}
        >
          <View
            style={styles.modalCard}
            onStartShouldSetResponder={() => true}
          >
            <Text style={styles.modalTitle}>{pickerTitle}</Text>
            <View style={styles.modalGrid}>
              {monthOptions.map((month) => {
                const isActive =
                  (pickerTarget === "single" && month === selectedMonth) ||
                  (pickerTarget === "start" && month === rangeStart) ||
                  (pickerTarget === "end" && month === rangeEnd);
                return (
                  <Pressable
                    key={month}
                    style={[
                      styles.modalOption,
                      isActive && styles.modalOptionActive
                    ]}
                    onPress={() => handlePickMonth(month)}
                  >
                    <Text
                      style={[
                        styles.modalOptionText,
                        isActive && styles.modalOptionTextActive
                      ]}
                    >
                      {month}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    safeArea: {
      flex: 1,
      backgroundColor: theme.background
    },
    backgroundLayer: {
      position: "absolute",
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      overflow: "hidden"
    },
    backgroundBlob: {
      position: "absolute",
      width: 260,
      height: 260,
      borderRadius: 130
    },
    blobOne: {
      top: -40,
      left: -60,
      backgroundColor: theme.blobPrimary
    },
    blobTwo: {
      bottom: -80,
      right: -40,
      backgroundColor: theme.blobSecondary
    },
    glassOverlay: {
      position: "absolute",
      top: 0,
      left: 0,
      right: 0,
      bottom: 0
    },
    container: {
      flex: 1
    },
    header: {
      paddingHorizontal: 20,
      paddingTop: 16
    },
    topActions: {
      marginTop: 12
    },
    title: {
      fontSize: 24,
      fontWeight: "700",
      color: theme.textPrimary
    },
    subTitle: {
      marginTop: 6,
      fontSize: 13,
      color: theme.textSecondary
    },
    section: {
      marginTop: 20,
      padding: 16,
      backgroundColor: theme.card,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: theme.cardBorder
    },
    sectionTitle: {
      fontSize: 16,
      fontWeight: "600",
      color: theme.textPrimary,
      marginBottom: 12
    },
    sectionHeader: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginBottom: 8
    },
    sectionHint: {
      fontSize: 12,
      color: theme.textSecondary
    },
    inputLabel: {
      fontSize: 12,
      color: theme.textSecondary,
      marginBottom: 6
    },
    input: {
      borderWidth: 1,
      borderColor: theme.inputBorder,
      borderRadius: 10,
      paddingHorizontal: 12,
      paddingVertical: 10,
      fontSize: 14,
      color: theme.textPrimary,
      marginBottom: 10,
      backgroundColor: theme.inputBackground
    },
    chartToggleRow: {
      flexDirection: "row",
      backgroundColor: theme.toggleBackground,
      padding: 2,
      borderRadius: 10,
      marginBottom: 12
    },
    rangeRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      marginBottom: 12
    },
    rangeButton: {
      flex: 1,
      paddingVertical: 10,
      paddingHorizontal: 12,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: theme.inputBorder,
      backgroundColor: theme.inputBackground,
      marginHorizontal: 4
    },
    rangeLabel: {
      fontSize: 12,
      color: theme.textSecondary
    },
    rangeValue: {
      marginTop: 4,
      fontSize: 14,
      fontWeight: "600",
      color: theme.textPrimary
    },
    monthPickerButton: {
      paddingVertical: 12,
      paddingHorizontal: 12,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: theme.inputBorder,
      backgroundColor: theme.inputBackground,
      marginBottom: 12
    },
    monthPickerText: {
      marginTop: 4,
      fontSize: 16,
      fontWeight: "600",
      color: theme.textPrimary
    },
    toggleButton: {
      flex: 1,
      paddingVertical: 6,
      borderRadius: 8,
      backgroundColor: "transparent",
      alignItems: "center"
    },
    toggleButtonDivider: {
      marginRight: 2
    },
    toggleButtonActive: {
      backgroundColor: theme.toggleActive
    },
    toggleButtonText: {
      fontSize: 13,
      fontWeight: "600",
      color: theme.toggleText
    },
    toggleButtonTextActive: {
      color: theme.toggleTextActive
    },
    thresholdRow: {
      flexDirection: "row",
      alignItems: "center",
      marginBottom: 12
    },
    thresholdLabel: {
      fontSize: 13,
      color: theme.textPrimary,
      marginRight: 12
    },
    thresholdInput: {
      borderWidth: 1,
      borderColor: theme.inputBorder,
      borderRadius: 10,
      paddingHorizontal: 10,
      paddingVertical: 6,
      fontSize: 13,
      color: theme.textPrimary,
      backgroundColor: theme.inputBackground,
      minWidth: 80
    },
    timestampText: {
      marginTop: 8,
      fontSize: 12,
      color: theme.textSecondary
    },
    primaryButton: {
      backgroundColor: theme.accent,
      paddingVertical: 12,
      borderRadius: 12,
      alignItems: "center"
    },
    primaryButtonText: {
      color: "#ffffff",
      fontSize: 15,
      fontWeight: "600"
    },
    errorText: {
      marginTop: 10,
      color: theme.danger,
      fontSize: 13
    },
    summaryRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      marginBottom: 12
    },
    summaryCard: {
      flex: 1,
      backgroundColor: theme.mutedSurface,
      borderRadius: 12,
      paddingVertical: 12,
      paddingHorizontal: 8,
      marginHorizontal: 4,
      alignItems: "center"
    },
    summaryLabel: {
      fontSize: 12,
      color: theme.textSecondary
    },
    summaryValue: {
      marginTop: 6,
      fontSize: 16,
      fontWeight: "700",
      color: theme.textPrimary
    },
    listContent: {
      paddingBottom: 140
    },
    settingsContent: {
      paddingBottom: 140
    },
    chartContainer: {
      marginTop: 12
    },
    chartEmpty: {
      marginTop: 12,
      alignItems: "center"
    },
    recordCard: {
      marginHorizontal: 20,
      marginBottom: 12,
      padding: 14,
      borderRadius: 14,
      backgroundColor: theme.card,
      borderWidth: 1,
      borderColor: theme.cardBorder
    },
    recordRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      marginBottom: 6
    },
    recordDate: {
      fontSize: 14,
      fontWeight: "600",
      color: theme.textPrimary
    },
    recordHours: {
      fontSize: 14,
      fontWeight: "700",
      color: theme.textPrimary
    },
    recordLabel: {
      fontSize: 12,
      color: theme.textSecondary
    },
    recordTagRow: {
      flexDirection: "row",
      marginTop: 6
    },
    recordTag: {
      fontSize: 11,
      color: theme.recordTagText,
      backgroundColor: theme.recordTagBackground,
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: 8
    },
    missing: {
      borderColor: theme.danger,
      backgroundColor: theme.missingBackground
    },
    insufficient: {
      borderColor: theme.warning,
      backgroundColor: theme.insufficientBackground
    },
    emptyState: {
      marginTop: 24,
      alignItems: "center"
    },
    emptyText: {
      marginTop: 8,
      color: theme.textSecondary
    },
    bottomNav: {
      position: "absolute",
      left: 20,
      right: 20,
      bottom: 12,
      flexDirection: "row",
      backgroundColor: theme.card,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: theme.cardBorder,
      padding: 6,
      justifyContent: "space-between"
    },
    tabButton: {
      flex: 1,
      paddingVertical: 10,
      borderRadius: 12,
      alignItems: "center"
    },
    tabButtonActive: {
      backgroundColor: theme.toggleActive
    },
    tabText: {
      fontSize: 13,
      fontWeight: "600",
      color: theme.toggleText
    },
    tabTextActive: {
      color: theme.toggleTextActive
    },
    modalBackdrop: {
      flex: 1,
      backgroundColor: "rgba(0,0,0,0.35)",
      justifyContent: "center",
      alignItems: "center",
      padding: 20
    },
    modalCard: {
      width: "100%",
      maxWidth: 360,
      backgroundColor: theme.card,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: theme.cardBorder,
      padding: 16
    },
    modalTitle: {
      fontSize: 16,
      fontWeight: "600",
      color: theme.textPrimary,
      marginBottom: 12
    },
    modalGrid: {
      flexDirection: "row",
      flexWrap: "wrap",
      justifyContent: "space-between"
    },
    modalOption: {
      width: "30%",
      paddingVertical: 8,
      marginBottom: 10,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: theme.inputBorder,
      alignItems: "center"
    },
    modalOptionActive: {
      backgroundColor: theme.toggleActive,
      borderColor: theme.accent
    },
    modalOptionText: {
      fontSize: 12,
      color: theme.textSecondary
    },
    modalOptionTextActive: {
      color: theme.textPrimary,
      fontWeight: "600"
    }
  });
