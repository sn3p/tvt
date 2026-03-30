module Api
  module V1
    class AreaSpeciesController < ApplicationController
      def catalog
        instrument_api("species_catalog", year: params[:year], scope: params[:scope] || "all") do
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
        end
      rescue ActiveRecord::RecordNotFound
        render json: { error: "area not found" }, status: :not_found
      rescue ArgumentError, TypeError
        render json: { error: "invalid species catalog parameters" }, status: :unprocessable_entity
      end

      def grid
        instrument_api(
          "species_grid",
          year: params[:year],
          bird_id: params[:bird_id],
          metric: params[:metric],
        ) do
          snapshot = Species::GridSnapshot.new(
            area_slug: params[:area],
            year: params[:year],
            bird_id: params[:bird_id],
            metric: params[:metric],
            cell_size_m: params[:cell_size_m],
            min_n: params[:min_n] || 1,
            pc4: params[:pc4],
            include_private: params[:include_private],
            include_isorg: params[:include_isorg],
            bbox: params[:bbox],
          )
          render json: snapshot.as_json
        end
      rescue ActiveRecord::RecordNotFound
        render json: { error: "area not found" }, status: :not_found
      rescue ArgumentError, TypeError
        render json: { error: "invalid species grid parameters" }, status: :unprocessable_entity
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
