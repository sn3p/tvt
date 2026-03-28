module Api
  module V1
    class AreaSpeciesController < ApplicationController
      def manifest
        snapshot = Species::ManifestSnapshot.new(area_slug: params[:area], year: params[:year])
        render json: snapshot.as_json
      rescue ActiveRecord::RecordNotFound
        render json: { error: "area not found" }, status: :not_found
      rescue ArgumentError, TypeError
        render json: { error: "invalid species manifest parameters" }, status: :unprocessable_entity
      end
    end
  end
end
