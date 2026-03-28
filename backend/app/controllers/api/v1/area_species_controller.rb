module Api
  module V1
    class AreaSpeciesController < ApplicationController
      def catalog
        snapshot = Species::CatalogSnapshot.new(
          area_slug: params[:area],
          year: params[:year],
          pc4: params[:pc4],
          include_private: params[:include_private],
          include_isorg: params[:include_isorg],
          scope: params[:scope],
          bbox: params[:bbox],
        )
        render json: snapshot.as_json
      rescue ActiveRecord::RecordNotFound
        render json: { error: "area not found" }, status: :not_found
      rescue ArgumentError, TypeError
        render json: { error: "invalid species catalog parameters" }, status: :unprocessable_entity
      end

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
