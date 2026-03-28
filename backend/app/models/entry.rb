class Entry < ApplicationRecord
  has_many :entry_bird_counts, dependent: :delete_all
  has_many :birds, through: :entry_bird_counts
  has_many :entry_tile_memberships, dependent: :delete_all

  validates :year, :external_id, :pc4, :lat, :lng, presence: true
  validates :pc4, length: { is: 4 }
  validates :year, numericality: { only_integer: true, greater_than: 0 }
  validates :external_id, numericality: { only_integer: true, greater_than: 0 }
  validates :lat, numericality: true
  validates :lng, numericality: true

  scope :for_year, ->(year) { where(year: year) }
end
