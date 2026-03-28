require "json"
require "time"

module Imports
  class EntryBirdCountImporter
    BirdPayload = Struct.new(:fetched_at, :rows, keyword_init: true)

    def initialize(source: HarvestSource.new, logger: Rails.logger)
      @source = source
      @logger = logger
    end

    def import_year(year, batch_size: 1_000)
      payloads = collect_success_payloads(year)
      return 0 if payloads.empty?

      ensure_birds(payloads)
      entry_id_by_external_id = Entry.where(year: year, external_id: payloads.keys).pluck(:external_id, :id).to_h
      bird_id_by_external_id = Bird.where(external_id: extract_bird_ids(payloads)).pluck(:external_id, :id).to_h

      imported_entries = 0

      payloads.each_slice(batch_size) do |slice|
        entry_ids = []
        rows = []
        timestamp = Time.current

        slice.each do |external_id, payload|
          entry_id = entry_id_by_external_id[external_id]
          unless entry_id
            logger.warn("Skipping bird counts for missing entry year=#{year} external_id=#{external_id}")
            next
          end

          entry_ids << entry_id
          payload.rows.each do |bird_row|
            bird_id = bird_id_by_external_id[bird_row.fetch(:external_bird_id)]
            next unless bird_id

            rows << {
              entry_id: entry_id,
              bird_id: bird_id,
              rank: bird_row.fetch(:rank),
              count: bird_row.fetch(:count),
              bird_name_cache: bird_row[:name],
              created_at: timestamp,
              updated_at: timestamp,
            }
          end
          imported_entries += 1
        end

        EntryBirdCount.transaction do
          EntryBirdCount.where(entry_id: entry_ids).delete_all
          EntryBirdCount.insert_all(rows) if rows.any?
        end
      end

      logger.info("Imported entry bird counts year=#{year} entries=#{imported_entries}")
      imported_entries
    end

    private

    attr_reader :source, :logger

    def collect_success_payloads(year)
      payloads = {}

      source.entry_top_birds_files(year:).each do |path|
        path.foreach(chomp: true) do |line|
          next if line.blank?

          row = JSON.parse(line)
          next unless row["status"] == "ok"

          external_id = Integer(row.fetch("id"))
          fetched_at = parse_time(row["fetched_at"]) || Time.at(0)
          rows = normalize_rows(row)
          next if rows.empty?

          current = payloads[external_id]
          if current.nil? || fetched_at >= current.fetched_at
            payloads[external_id] = BirdPayload.new(fetched_at:, rows:)
          end
        rescue JSON::ParserError, KeyError, ArgumentError, TypeError => e
          logger.warn("Skipping malformed entry_top_birds row path=#{path} error=#{e.class}: #{e.message}")
        end
      end

      payloads
    end

    def normalize_rows(row)
      data_rows = row.dig("data", "data")
      return [] unless data_rows.is_a?(Array)

      data_rows.filter_map do |bird_row|
        next unless bird_row.is_a?(Hash)

        external_bird_id = Integer(bird_row.fetch("id"))
        count = Integer(bird_row.fetch("number"))
        rank = Integer(bird_row.fetch("order"))
        next if count.negative?

        {
          external_bird_id:,
          count:,
          rank:,
          name: bird_row["name"].presence || bird_row["vogelnaam"].presence,
        }
      rescue KeyError, ArgumentError, TypeError
        nil
      end
    end

    def ensure_birds(payloads)
      names_by_external_id = {}
      payloads.each_value do |payload|
        payload.rows.each do |row|
          names_by_external_id[row.fetch(:external_bird_id)] ||= row[:name].presence || "Bird #{row.fetch(:external_bird_id)}"
        end
      end

      timestamp = Time.current
      rows = names_by_external_id.map do |external_id, name|
        {
          external_id:,
          name:,
          created_at: timestamp,
          updated_at: timestamp,
        }
      end

      Bird.upsert_all(rows, unique_by: :index_birds_on_external_id) if rows.any?
    end

    def extract_bird_ids(payloads)
      payloads.values.flat_map { |payload| payload.rows.map { |row| row.fetch(:external_bird_id) } }.uniq
    end

    def parse_time(value)
      return if value.blank?

      Time.iso8601(value)
    rescue ArgumentError
      nil
    end
  end
end
