require "json"
require "time"

module Ops
  class ImportVerifier
    ZOOM_RANGE = (6..13).freeze

    Result = Struct.new(:year, :expected, :actual, :ok, :mismatches, keyword_init: true) do
      def as_json(*_args)
        {
          year: year,
          ok: ok,
          expected: expected,
          actual: actual,
          mismatches: mismatches,
        }
      end
    end

    BirdPayload = Struct.new(:fetched_at, :rows, keyword_init: true)

    def initialize(source: Imports::HarvestSource.new)
      @source = source
    end

    def verify_year(year)
      expected = expected_counts(year)
      actual = actual_counts(year)
      mismatches = build_mismatches(expected, actual)

      Result.new(
        year: year.to_i,
        expected: expected,
        actual: actual,
        ok: mismatches.empty?,
        mismatches: mismatches,
      )
    end

    def verify_years(years)
      Array(years).map { |year| verify_year(year) }
    end

    private

    attr_reader :source

    def expected_counts(year)
      entry_ids = collect_entry_ids(year, mode: "type1")
      isorg_ids = collect_entry_ids(year, mode: "isorg")
      top_bird_rows_count = collect_success_payloads(year).values.sum { |payload| payload.rows.length }

      {
        entries_count: entry_ids.length,
        private_entries_count: entry_ids.length - isorg_ids.length,
        isorg_entries_count: isorg_ids.length,
        top_bird_rows_count: top_bird_rows_count,
        tile_memberships: {
          private: (entry_ids.length - isorg_ids.length) * ZOOM_RANGE.count,
          isorg: isorg_ids.length * ZOOM_RANGE.count,
        },
      }
    end

    def actual_counts(year)
      entries_relation = Entry.where(year: year)
      isorg_count = entries_relation.where(is_org: true).count

      {
        entries_count: entries_relation.count,
        private_entries_count: entries_relation.where(is_org: false).count,
        isorg_entries_count: isorg_count,
        top_bird_rows_count: EntryBirdCount.joins(:entry).where(entries: { year: year }).count,
        tile_memberships: {
          private: EntryTileMembership.where(year: year, mode: "private").count,
          isorg: EntryTileMembership.where(year: year, mode: "isorg").count,
        },
      }
    end

    def collect_entry_ids(year, mode:)
      ids = {}

      source.entry_index_files(year:, mode:).each do |path|
        path.each_line(chomp: true) do |line|
          next if line.blank?

          row = JSON.parse(line)
          ids[Integer(row.fetch("id"))] = true
        rescue JSON::ParserError, KeyError, ArgumentError, TypeError
          next
        end
      end

      ids.keys.sort
    end

    def collect_success_payloads(year)
      payloads = {}

      source.entry_top_birds_files(year:).each do |path|
        path.each_line(chomp: true) do |line|
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
        rescue JSON::ParserError, KeyError, ArgumentError, TypeError
          next
        end
      end

      payloads
    end

    def normalize_rows(row)
      data_rows = row.dig("data", "data")
      return [] unless data_rows.is_a?(Array)

      data_rows.filter_map do |bird_row|
        next unless bird_row.is_a?(Hash)

        count = Integer(bird_row.fetch("number"))
        next if count.negative?

        {
          external_bird_id: Integer(bird_row.fetch("id")),
          count: count,
          rank: Integer(bird_row.fetch("order")),
        }
      rescue KeyError, ArgumentError, TypeError
        nil
      end
    end

    def parse_time(value)
      return if value.blank?

      Time.iso8601(value)
    rescue ArgumentError
      nil
    end

    def build_mismatches(expected, actual, prefix = nil)
      expected.each_with_object([]) do |(key, expected_value), out|
        actual_value = actual[key]
        label = [prefix, key].compact.join(".")

        if expected_value.is_a?(Hash)
          out.concat(build_mismatches(expected_value, actual_value || {}, label))
        elsif expected_value != actual_value
          out << {
            field: label,
            expected: expected_value,
            actual: actual_value,
          }
        end
      end
    end
  end
end
