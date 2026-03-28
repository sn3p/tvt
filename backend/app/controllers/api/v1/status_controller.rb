module Api
  module V1
    class StatusController < ApplicationController
      def show
        render json: {
          ok: true,
          database: {
            connected: database_connected?,
          },
          years: year_summaries,
          latest_update_utc: latest_update&.utc&.iso8601,
        }
      end

      private

      def database_connected?
        ActiveRecord::Base.connection_pool.with_connection(&:active?)
      rescue StandardError
        false
      end

      def year_summaries
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

      def latest_update
        [
          Entry.maximum(:updated_at),
          EntryBirdCount.maximum(:updated_at),
          EntryTileMembership.maximum(:updated_at),
        ].compact.max
      end
    end
  end
end
