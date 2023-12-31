import { render, RenderPosition, remove } from '../framework/render.js';
import TripSortView from '../view/trip-sort-view.js';
import PointsListView from '../view/trip-point-list-view.js';
import EmptyListView from '../view/empty-list-view.js';
import LoadingView from '../view/loading-view';
import PointPresenter from './point-presenter';
import PointNewPresenter from './new-point-presenter.js';
import { sortPointUp, comparePrice, compareDuration } from '../utils/point.js';
import { filter, SortType, UserAction, UpdateType, FilterType } from '../utils/const.js';

export default class TripPresenter {
  #container = null;
  #pointsModel = null;
  #destinationsModel = null;
  #offersModel = null;
  #filterModel = null;

  #pointsListView = new PointsListView();
  #loadingComponent = new LoadingView();
  #sortComponent = null;
  #emptyListView = null;
  #pointNewPresenter = null;
  #pointPresenter = new Map();

  #currentSortType = SortType.DEFAULT;
  #filterType = FilterType.EVERYTHING;
  #isLoading = true;


  constructor(container, pointsModel, filterModel, offersModel, destinationsModel) {
    this.#container = container;
    this.#pointsModel = pointsModel;
    this.#filterModel = filterModel;
    this.#offersModel = offersModel;
    this.#destinationsModel = destinationsModel;

    this.#pointNewPresenter = new PointNewPresenter(this.#pointsListView.element, this.#handleViewAction, this.#handleModeChange);

    this.#pointsModel.addObserver(this.#handleModelEvent);
    this.#filterModel.addObserver(this.#handleModelEvent);
  }

  get points() {
    this.#filterType = this.#filterModel.filter;
    const points = this.#pointsModel.points;
    const filteredPoints = filter[this.#filterType](points);

    switch (this.#currentSortType) {
      case SortType.DEFAULT:
        return filteredPoints.sort(sortPointUp);
      case SortType.TIME:
        return filteredPoints.sort(compareDuration);
      case SortType.PRICE:
        return filteredPoints.sort(comparePrice);
    }
    return filteredPoints;
  }

  init = () => {
    this.#renderTrip();
  };


  createPoint = async (callback, offersList, destinations) => {
    offersList = await this.#offersModel.get();
    destinations = await this.#destinationsModel.get();

    this.#currentSortType = SortType.DEFAULT;
    this.#filterModel.setFilter(UpdateType.MAJOR, FilterType.EVERYTHING);
    this.#pointNewPresenter.init(callback, offersList, destinations);
  };

  #handleSortTypeChange = (sortType) => {
    if (this.#currentSortType === sortType) {
      return;
    }

    this.#currentSortType = sortType;

    this.#clearTrip();
    this.#renderTrip();
  };

  #renderSort = () => {
    this.#sortComponent = new TripSortView(this.#currentSortType);
    this.#sortComponent.setSortTypeChangeHandler(this.#handleSortTypeChange);

    render(this.#sortComponent, this.#container);
  };


  #handleViewAction = async (actionType, updateType, update) => {
    switch (actionType) {
      case UserAction.UPDATE_POINT:
        this.#pointPresenter.get(update.id).setSaving();
        try {
          this.#pointsModel.updatePoint(updateType, update);
        } catch (err) {
          this.#pointPresenter.get(update.id).setAborting();
        }
        break;
      case UserAction.ADD_POINT:
        this.#pointNewPresenter.setSaving();
        try {
          this.#pointsModel.addPoint(updateType, update);
        } catch (err) {
          this.#pointNewPresenter.setAborting();
        }
        break;
      case UserAction.DELETE_POINT:
        this.#pointPresenter.get(update.id).setDeleting();
        this.#pointsModel.deletePoint(updateType, update);
        break;
    }
  };


  #handleModelEvent = (updateType, data) => {
    switch (updateType) {
      case UpdateType.PATCH:
        // - обновить часть списка (например, когда поменялось описание)
        this.#pointPresenter.get(data.id).init(data);
        break;
      case UpdateType.MINOR:
        // - обновить список (например, когда задача ушла в архив)
        this.#clearTrip();
        this.#renderTrip();
        break;
      case UpdateType.MAJOR:
        // - обновить всю доску (например, при переключении фильтра)
        this.#clearTrip({resetSortType: true});
        this.#renderTrip();
        break;
      case UpdateType.INIT:
        this.#isLoading = false;
        remove(this.#loadingComponent);
        this.#clearTrip();
        this.#renderTrip();
        break;
    }
  };

  #handleModeChange = () => {
    this.#pointNewPresenter.destroy();
    this.#pointPresenter.forEach((presenter) => presenter.resetView());
  };

  #renderPoint = (point, offersList, destinations) => {

    const pointPresenter = new PointPresenter(this.#pointsListView.element, this.#handleViewAction, this.#handleModeChange);
    pointPresenter.init(point, offersList, destinations);
    this.#pointPresenter.set(point.id, pointPresenter);
  };

  #renderPoints = async (points, offersList, destinations) => {
    offersList = await this.#offersModel.get();
    destinations = await this.#destinationsModel.get();

    points.forEach((point) => this.#renderPoint(point, offersList, destinations));
  };

  #renderNoPoints = () => {
    this.#emptyListView = new EmptyListView(this.#filterType);
    render(this.#emptyListView, this.#pointsListView.element, RenderPosition.AFTERBEGIN);
  };

  #renderLoading = () => {
    render(this.#loadingComponent, this.#pointsListView.element, RenderPosition.AFTERBEGIN);
  };

  #clearTrip = ({resetSortType = false} = {}) => {
    this.#pointNewPresenter.destroy();
    this.#pointPresenter.forEach((presenter) => presenter.destroy());
    this.#pointPresenter.clear();

    remove(this.#sortComponent);
    remove(this.#loadingComponent);

    if (this.#emptyListView) {
      remove(this.#emptyListView);
    }

    if (resetSortType) {
      this.#currentSortType = SortType.DEFAULT;
    }
  };


  #renderTrip = () => {
    this.#renderSort();
    render(this.#pointsListView, this.#container);

    if (this.#isLoading || this.#isLoading === undefined) {
      this.#renderLoading();
      return;
    }

    const pointCount = this.points.length;

    if (pointCount === 0) {
      this.#renderNoPoints();
      return;
    }

    this.#renderPoints(this.points);
  };
}
