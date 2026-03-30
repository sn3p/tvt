module Api
  module V1
    class Pc4BoundsController < ApplicationController
      def show
        snapshot = Navigation::Pc4BoundsSnapshot.new(
          year: params[:year],
          pc4: params[:pc4],
        )
        render json: snapshot.as_json
      rescue ActiveRecord::RecordNotFound
        render json: { error: "pc4 not found" }, status: :not_found
      rescue ArgumentError, TypeError
        render json: { error: "invalid pc4 bounds parameters" }, status: :unprocessable_entity
      end
    end
  end
end
