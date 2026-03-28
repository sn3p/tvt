module Api
  module V1
    class PointTilesController < ApplicationController
      ZOOM_MIN = 6
      ZOOM_MAX = 13
      MODES = EntryTileMembership::MODES
      CONTRACT_VERSION = 1

      def manifest
        years = Entry.order(:year).distinct.pluck(:year)
        generated_at = EntryTileMembership.maximum(:updated_at) || Entry.maximum(:updated_at)

        render json: {
          contract_version: CONTRACT_VERSION,
          generated_at_utc: generated_at&.utc&.iso8601,
          years_available: years,
          modes_available: MODES,
          defaults: {
            year: years.max,
            mode: "private",
            zoom_min: ZOOM_MIN,
            zoom_max: ZOOM_MAX,
          },
          paths: {
            points_root: "api/v1/years/{year}/point_tiles/{mode}/{z}/{x}/{y}",
          },
        }
      end

      def show
        mode = params[:mode].to_s
        return render_invalid_mode(mode) unless MODES.include?(mode)

        year = Integer(params[:year])
        z = Integer(params[:z])
        x = Integer(params[:x])
        y = Integer(params[:y])

        memberships = EntryTileMembership
          .for_tile(year:, mode:, z:, x:, y:)
          .includes(:entry)

        render json: {
          contract_version: CONTRACT_VERSION,
          year: year,
          mode: mode,
          z: z,
          x: x,
          y: y,
          tileSize: 256,
          points: memberships.map { |membership| point_payload(membership.entry) },
        }
      rescue ArgumentError, TypeError
        render json: { error: "invalid tile parameters" }, status: :unprocessable_entity
      end

      private

      def point_payload(entry)
        {
          id: entry.external_id,
          lat: entry.lat.to_f,
          lng: entry.lng.to_f,
          pc4: entry.pc4,
        }
      end

      def render_invalid_mode(mode)
        render json: { error: "unsupported mode: #{mode}" }, status: :unprocessable_entity
      end
    end
  end
end
