import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  TextInput,
  View
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import axios from "axios";
import dayjs from "dayjs";

import {
  AttendanceRecord,
  AttendanceSummary,
  buildAttendanceRecords,
  calculateSummary,
  formatHours,
  isInsufficientHours,
  nextMonth
} from "./src/lib/attendance";

const API_URL = Platform.OS === "web"
  ? "http://localhost:8787/attendance"
  : "https://im.360teams.com/api/qfin-api/securityapi/attendance/query/detail";
const STORAGE_EMCODE = "attendance.emCode";
const STORAGE_AUTH = "attendance.authorization";
const DEFAULT_EMCODE = "JR1001913";
const DEFAULT_AUTH = "97611d5d17f4447da7e806bb9697b64a";

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

export default function App() {
  const [emCode, setEmCode] = useState("");
  const [authorization, setAuthorization] = useState("");
  const [month, setMonth] = useState(dayjs().format("YYYY-MM"));
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [summary, setSummary] = useState<AttendanceSummary>({
    validDays: 0,
    validHours: 0,
    avgHours: null
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(false);

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

  const monthLabel = useMemo(() => month, [month]);

  const changeMonth = useCallback(
    (delta: number) => {
      const next = dayjs(`${month}-01`).add(delta, "month").format("YYYY-MM");
      setMonth(next);
    },
    [month]
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

  const handleFetch = useCallback(async () => {
    if (!emCode.trim() || !authorization.trim()) {
      setError("请先填写 emCode 与 Authorization。");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const cycles = [month, nextMonth(month)];
      const [current, following] = await Promise.all(
        cycles.map((cycle) => getAttendanceData(cycle))
      );
      const merged = [...current, ...following];
      const mapped = buildAttendanceRecords(merged, month);
      const nextSummary = calculateSummary(mapped);
      setRecords(mapped);
      setSummary(nextSummary);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "请求失败，请检查配置。";
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [authorization, emCode, getAttendanceData, month]);

  const renderItem = useCallback(({ item }: { item: AttendanceRecord }) => {
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
          <Text style={styles.recordHours}>{formatHours(item.workHours)}</Text>
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
      </View>
    );
  }, []);

  const summaryAvgText =
    summary.avgHours === null ? "异常" : formatHours(summary.avgHours);

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <FlatList
          data={records}
          keyExtractor={(item) => item.date}
          renderItem={renderItem}
          ListHeaderComponent={
            <View style={styles.header}>
              <Text style={styles.title}>Teams 工时统计</Text>

              <View style={styles.section}>
                <Text style={styles.sectionTitle}>设置</Text>
                <TextInput
                  style={styles.input}
                  placeholder="emCode"
                  value={emCode}
                  autoCapitalize="none"
                  onChangeText={setEmCode}
                />
                <TextInput
                  style={styles.input}
                  placeholder="Authorization"
                  value={authorization}
                  autoCapitalize="none"
                  onChangeText={setAuthorization}
                />
              </View>

              <View style={styles.section}>
                <Text style={styles.sectionTitle}>查询控制</Text>
                <View style={styles.monthRow}>
                  <Pressable
                    style={[styles.iconButton, styles.iconButtonLeft]}
                    onPress={() => changeMonth(-1)}
                  >
                    <Text style={styles.iconButtonText}>{"<"}</Text>
                  </Pressable>
                  <Text style={styles.monthLabel}>{monthLabel}</Text>
                  <Pressable
                    style={[styles.iconButton, styles.iconButtonRight]}
                    onPress={() => changeMonth(1)}
                  >
                    <Text style={styles.iconButtonText}>{">"}</Text>
                  </Pressable>
                </View>
                <Pressable
                  style={styles.primaryButton}
                  onPress={handleFetch}
                  disabled={loading}
                >
                  <Text style={styles.primaryButtonText}>
                    {loading ? "查询中..." : "查询 / 刷新"}
                  </Text>
                </Pressable>
                {error ? <Text style={styles.errorText}>{error}</Text> : null}
              </View>

              <View style={styles.section}>
                <Text style={styles.sectionTitle}>概览</Text>
                <View style={styles.summaryRow}>
                  <View style={styles.summaryCard}>
                    <Text style={styles.summaryLabel}>平均工时</Text>
                    <Text style={styles.summaryValue}>{summaryAvgText}</Text>
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
              </View>

              <View style={styles.section}>
                <Text style={styles.sectionTitle}>明细</Text>
              </View>
            </View>
          }
          ListEmptyComponent={
            loading ? (
              <View style={styles.emptyState}>
                <ActivityIndicator size="small" color="#111827" />
                <Text style={styles.emptyText}>正在加载...</Text>
              </View>
            ) : (
              <View style={styles.emptyState}>
                <Text style={styles.emptyText}>暂无记录，请先查询。</Text>
              </View>
            )
          }
          contentContainerStyle={styles.listContent}
          keyboardShouldPersistTaps="handled"
        />
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#f8f5f1"
  },
  container: {
    flex: 1
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 16
  },
  title: {
    fontSize: 24,
    fontWeight: "700",
    color: "#1f2933"
  },
  section: {
    marginTop: 20,
    padding: 16,
    backgroundColor: "#ffffff",
    borderRadius: 16,
    shadowColor: "#0f172a",
    shadowOpacity: 0.08,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 10,
    elevation: 2
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#334155",
    marginBottom: 12
  },
  input: {
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: "#0f172a",
    marginBottom: 10,
    backgroundColor: "#f8fafc"
  },
  monthRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12
  },
  monthLabel: {
    fontSize: 18,
    fontWeight: "600",
    color: "#1e293b",
    marginHorizontal: 16
  },
  iconButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#e2e8f0",
    alignItems: "center",
    justifyContent: "center"
  },
  iconButtonLeft: {
    marginRight: 8
  },
  iconButtonRight: {
    marginLeft: 8
  },
  iconButtonText: {
    fontSize: 18,
    color: "#334155",
    fontWeight: "600"
  },
  primaryButton: {
    backgroundColor: "#0f172a",
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
    color: "#b91c1c",
    fontSize: 13
  },
  summaryRow: {
    flexDirection: "row",
    justifyContent: "space-between"
  },
  summaryCard: {
    flex: 1,
    backgroundColor: "#f1f5f9",
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 8,
    marginHorizontal: 4,
    alignItems: "center"
  },
  summaryLabel: {
    fontSize: 12,
    color: "#475569"
  },
  summaryValue: {
    marginTop: 6,
    fontSize: 16,
    fontWeight: "700",
    color: "#0f172a"
  },
  listContent: {
    paddingBottom: 32
  },
  recordCard: {
    marginHorizontal: 20,
    marginBottom: 12,
    padding: 14,
    borderRadius: 14,
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#e2e8f0"
  },
  recordRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 6
  },
  recordDate: {
    fontSize: 14,
    fontWeight: "600",
    color: "#0f172a"
  },
  recordHours: {
    fontSize: 14,
    fontWeight: "700",
    color: "#0f172a"
  },
  recordLabel: {
    fontSize: 12,
    color: "#475569"
  },
  missing: {
    borderColor: "#dc2626",
    backgroundColor: "#fef2f2"
  },
  insufficient: {
    borderColor: "#f97316",
    backgroundColor: "#fff7ed"
  },
  emptyState: {
    marginTop: 24,
    alignItems: "center"
  },
  emptyText: {
    marginTop: 8,
    color: "#64748b"
  }
});
