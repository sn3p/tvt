module Api
  module V1
    class EntriesController < ApplicationController
      def top_birds
        year = Integer(params[:year])
        external_id = Integer(params[:id])
        raise ArgumentError, "invalid entry parameters" unless year.positive? && external_id.positive?

        entry = Entry.find_by!(year:, external_id:)

        birds = entry.entry_bird_counts.includes(:bird).ordered.map do |row|
          {
            bird_id: row.bird.external_id,
            name: row.bird.name.presence || row.bird_name_cache,
            count: row.count,
            rank: row.rank,
          }
        end

        render json: {
          entry_id: entry.external_id,
          year: entry.year,
          birds: birds,
        }
      rescue ActiveRecord::RecordNotFound
        render json: { error: "entry not found" }, status: :not_found
      rescue ArgumentError, TypeError
        render json: { error: "invalid entry parameters" }, status: :unprocessable_entity
      end
    end
  end
end
