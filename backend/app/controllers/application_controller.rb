class ApplicationController < ActionController::API
  private

  def instrument_api(metric_name, extra = {})
    started_at = Process.clock_gettime(Process::CLOCK_MONOTONIC)
    yield
  ensure
    duration_ms =
      ((Process.clock_gettime(Process::CLOCK_MONOTONIC) - started_at) * 1000.0).round(1)
    append_server_timing(metric_name, duration_ms)
    Rails.logger.info(
      [
        "[api_timing]",
        "metric=#{metric_name}",
        "duration_ms=#{duration_ms}",
        "path=#{request.fullpath}",
        ("status=#{response.status}" if response&.status),
        *extra.map { |key, value| "#{key}=#{value}" },
      ].compact.join(" "),
    )
  end

  def append_server_timing(metric_name, duration_ms)
    segment = "#{metric_name};dur=#{duration_ms}"
    existing = response.headers["Server-Timing"].to_s
    response.headers["Server-Timing"] =
      existing.empty? ? segment : "#{existing}, #{segment}"
  end
end
