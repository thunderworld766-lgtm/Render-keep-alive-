export type MonitorState = "live" | "down" | "unknown";

export interface CheckResult {
  id: string;
  website_id: string;
  checked_at: string;
  state: MonitorState;
  status_code: number | null;
  response_time_ms: number | null;
  error_message: string | null;
}

export interface Website {
  id: string;
  url: string;
  created_at: string;
  last_checked_at: string | null;
  current_state: MonitorState;
  status_code: number | null;
  response_time_ms: number | null;
  history?: CheckResult[];
}
