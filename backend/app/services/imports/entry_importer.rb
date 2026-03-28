require "json"
require "time"

module Imports
  class EntryImporter
    def initialize(source: HarvestSource.new, logger: Rails.logger)
      @source = source
      @logger = logger
    end

    def import_year(year)
      records = collect_records(year)
      return 0 if records.empty?

      timestamp = Time.current
      payload = records.values.map do |record|
        {
          year: year,
          external_id: record.fetch(:external_id),
          pc4: record.fetch(:pc4),
          lat: record.fetch(:lat),
          lng: record.fetch(:lng),
          is_org: record.fetch(:is_org),
          source_fetched_at: record[:source_fetched_at],
          created_at: timestamp,
          updated_at: timestamp,
        }
      end

      Entry.upsert_all(payload, unique_by: :index_entries_on_year_and_external_id)
      logger.info("Imported entries year=#{year} count=#{payload.length}")
      payload.length
    end

    private

    attr_reader :source, :logger

    def collect_records(year)
      records = {}

      ingest_mode(records, year:, mode: "type1", is_org: false)
      ingest_mode(records, year:, mode: "isorg", is_org: true)

      records
    end

    def ingest_mode(records, year:, mode:, is_org:)
      source.entry_index_files(year:, mode:).each do |path|
        path.each_line(chomp: true) do |line|
          next if line.blank?

          row = JSON.parse(line)
          entry_id = Integer(row.fetch("id"))
          fetched_at = parse_time(row["fetched_at"])

          current = records[entry_id]
          candidate = {
            external_id: entry_id,
            pc4: row.fetch("pc4").to_s.rjust(4, "0"),
            lat: Float(row.fetch("lat")),
            lng: Float(row.fetch("lng")),
            is_org: is_org,
            source_fetched_at: fetched_at,
          }

          if current.nil?
            records[entry_id] = candidate
            next
          end

          if current[:source_fetched_at].nil? || (!fetched_at.nil? && fetched_at >= current[:source_fetched_at])
            current[:pc4] = candidate[:pc4]
            current[:lat] = candidate[:lat]
            current[:lng] = candidate[:lng]
            current[:source_fetched_at] = fetched_at
          end

          current[:is_org] ||= is_org
        rescue JSON::ParserError, KeyError, ArgumentError, TypeError => e
          logger.warn("Skipping malformed entry_index row path=#{path} mode=#{mode} error=#{e.class}: #{e.message}")
        end
      end
    end

    def parse_time(value)
      return if value.blank?

      Time.iso8601(value)
    rescue ArgumentError
      nil
    end
  end
end
