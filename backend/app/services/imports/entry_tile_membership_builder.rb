module Imports
  class EntryTileMembershipBuilder
    MIN_LAT = -85.05112878
    MAX_LAT = 85.05112878

    def initialize(logger: Rails.logger)
      @logger = logger
    end

    def rebuild_year(year, zoom_range: 6..13, batch_size: 10_000)
      rows = []
      timestamp = Time.current
      count = 0

      EntryTileMembership.where(year: year).delete_all

      Entry.for_year(year).find_each do |entry|
        mode = entry.is_org? ? "isorg" : "private"

        zoom_range.each do |z|
          x, y = tile_xy(lat: entry.lat.to_f, lng: entry.lng.to_f, z:)
          rows << {
            entry_id: entry.id,
            year: year,
            mode: mode,
            z: z,
            x: x,
            y: y,
            created_at: timestamp,
            updated_at: timestamp,
          }
          count += 1

          if rows.length >= batch_size
            EntryTileMembership.insert_all(rows)
            rows.clear
          end
        end
      end

      EntryTileMembership.insert_all(rows) if rows.any?
      logger.info("Rebuilt tile memberships year=#{year} count=#{count}")
      count
    end

    private

    attr_reader :logger

    def tile_xy(lat:, lng:, z:)
      n = 2**z
      lat_clamped = [[lat, MIN_LAT].max, MAX_LAT].min
      x = (((lng + 180.0) / 360.0) * n).floor
      lat_rad = lat_clamped * Math::PI / 180.0
      y = ((1 - Math.log(Math.tan(lat_rad) + (1 / Math.cos(lat_rad))) / Math::PI) / 2 * n).floor
      [x.clamp(0, n - 1), y.clamp(0, n - 1)]
    end
  end
end
