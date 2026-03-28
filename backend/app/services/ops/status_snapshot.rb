module Ops
  class StatusSnapshot
    def as_json(*_args)
      {
        ok: true,
        database: {
          connected: database_connected?,
        },
        years: year_summaries,
        latest_update_utc: latest_update&.utc&.iso8601,
      }
    end

    def year_summary(year)
      year_summaries.find { |row| row[:year] == year.to_i }
    end

    private

    def database_connected?
      connection = ActiveRecord::Base.connection
      connection.select_value("SELECT 1")
      true
    rescue StandardError
      false
    end

    def year_summaries
      @year_summaries ||= begin
        entry_counts = Entry.group(:year).count
        isorg_counts = Entry.where(is_org: true).group(:year).count
        top_bird_row_counts = EntryBirdCount.joins(:entry).group("entries.year").count
        tile_counts = EntryTileMembership.group(:year, :mode).count

        years = (entry_counts.keys + top_bird_row_counts.keys + tile_counts.keys.map(&:first)).uniq.sort

        years.map do |year|
          {
            year: year,
            entries_count: entry_counts.fetch(year, 0),
            private_entries_count: entry_counts.fetch(year, 0) - isorg_counts.fetch(year, 0),
            isorg_entries_count: isorg_counts.fetch(year, 0),
            top_bird_rows_count: top_bird_row_counts.fetch(year, 0),
            tile_memberships: {
              private: tile_counts.fetch([year, "private"], 0),
              isorg: tile_counts.fetch([year, "isorg"], 0),
            },
          }
        end
      end
    end

    def latest_update
      [
        Entry.maximum(:updated_at),
        EntryBirdCount.maximum(:updated_at),
        EntryTileMembership.maximum(:updated_at),
      ].compact.max
    end
  end
end
