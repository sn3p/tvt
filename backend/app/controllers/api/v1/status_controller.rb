module Api
  module V1
    class StatusController < ApplicationController
      def show
        render json: Ops::StatusSnapshot.new.as_json
      end
    end
  end
end
