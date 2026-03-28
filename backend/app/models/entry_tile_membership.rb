class EntryTileMembership < ApplicationRecord
  MODES = %w[private isorg].freeze

  belongs_to :entry

  validates :year, :mode, :z, :x, :y, presence: true
  validates :year, :z, :x, :y, numericality: { only_integer: true, greater_than_or_equal_to: 0 }
  validates :mode, inclusion: { in: MODES }

  scope :for_tile, ->(year:, mode:, z:, x:, y:) { where(year: year, mode: mode, z: z, x: x, y: y) }
end
