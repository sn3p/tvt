require "pathname"

module Imports
  class HarvestSource
    DEFAULT_RELATIVE_ROOT = Pathname.new("../../tvt-harvest").freeze

    def initialize(root: ENV["TVT_HARVEST_ROOT"])
      @root = if root.present?
        Pathname.new(root).expand_path
      else
        Rails.root.join(DEFAULT_RELATIVE_ROOT).expand_path
      end
    end

    attr_reader :root

    def entry_index_files(year:, mode:)
      files_for(root.join("data/raw", year.to_s, "entry_index", mode.to_s), pattern: "*.ndjson")
    end

    def entry_top_birds_files(year:)
      files_for(root.join("data/raw", year.to_s, "entry_top_birds"), pattern: "*.ndjson")
    end

    def available_years
      years_root = root.join("data/raw")
      return [] unless years_root.directory?

      years_root.children
        .select(&:directory?)
        .map { |path| Integer(path.basename.to_s, exception: false) }
        .compact
        .sort
    end

    private

    def files_for(dir, pattern:)
      raise ArgumentError, "Missing harvest path: #{dir}" unless dir.directory?

      dir.glob(pattern).sort
    end
  end
end
