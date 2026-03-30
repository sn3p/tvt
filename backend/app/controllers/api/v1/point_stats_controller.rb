module Api
  module V1
    class PointStatsController < ApplicationController
      def show
        instrument_api("point_stats", year: params[:year]) do
          snapshot = Points::StatsSnapshot.new(
            year: params[:year],
            pc4: params[:pc4],
            include_private: params[:include_private],
            include_isorg: params[:include_isorg],
            bbox: params[:bbox],
            scope: params[:scope],
          )
          render json: snapshot.as_json
        end
      rescue ArgumentError, TypeError
        render json: { error: "invalid point stats parameters" }, status: :unprocessable_entity
      end
    end
  end
end
