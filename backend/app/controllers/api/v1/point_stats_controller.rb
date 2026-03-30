module Api
  module V1
    class PointStatsController < ApplicationController
      def show
        snapshot = Points::StatsSnapshot.new(
          year: params[:year],
          pc4: params[:pc4],
          include_private: params[:include_private],
          include_isorg: params[:include_isorg],
          bbox: params[:bbox],
        )
        render json: snapshot.as_json
      rescue ArgumentError, TypeError
        render json: { error: "invalid point stats parameters" }, status: :unprocessable_entity
      end
    end
  end
end
