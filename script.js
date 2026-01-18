// ------------------------
// Supabase Initialization
// ------------------------
const supabaseUrl = "https://yfvshmfkyxcwgyhfhqms.supabase.co";
const supabaseAnonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlmdnNobWZreXhjd2d5aGZocW1zIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg1MTc5NzIsImV4cCI6MjA4NDA5Mzk3Mn0.jMSSyu1ISa1dArbASM9szweWyZONpM1z1XfPHHr6eMc";
const supabaseClient = supabase.createClient(supabaseUrl, supabaseAnonKey);

// ------------------------
// Protect Page
// ------------------------
async function protectPage() {
  const { data: { session } } = await supabaseClient.auth.getSession();
  if (!session || !session.user) {
    window.location.href = "/login.html";
    return;
  }
  if (!session.user.confirmed_at) {
    alert("Please verify your email before accessing this page.");
    await supabaseClient.auth.signOut();
    window.location.href = "/login.html";
  }
}
protectPage();

// ------------------------
// DOM Elements
// ------------------------
const professorSearch = document.getElementById("professorSearch");
const professorList = document.getElementById("professorList");
const ratingSection = document.getElementById("ratingSection");
const profName = document.getElementById("profName");
const reviewsDiv = document.getElementById("reviews");
const ratingInput = document.getElementById("rating");
const commentInput = document.getElementById("comment");
const courseInput = document.getElementById("course");
const wouldTakeAgainSelect = document.getElementById("wouldTakeAgain");
const submitBtn = document.getElementById("submitRating");

// ------------------------
// State
// ------------------------
let professors = [];
let selectedProfId = null;

async function loadTopProfessors(minReviews = 5) {
  const { data: professorsData, error: profError } = await supabaseClient
    .from("professors")
    .select(`
      id,
      name,
      reviews (
        rating
      )
    `);

  if (profError) {
    console.error("Failed to load professors:", profError.message);
    return;
  }

  const professors = professorsData.map(prof => {
    const ratings = (prof.reviews || [])
      .map(r => r.rating)
      .filter(r => r != null);

    const avgRating = ratings.length > 0
      ? ratings.reduce((a, b) => a + b, 0) / ratings.length
      : 0;

    return {
      id: prof.id,
      name: prof.name,
      avgRating,
      reviewCount: ratings.length
    };
  })
  // Only include professors with at least minReviews reviews
  .filter(prof => prof.reviewCount >= minReviews)
  // Sort by avgRating descending, breaking ties with reviewCount
  .sort((a, b) => {
    if (b.avgRating === a.avgRating) return b.reviewCount - a.reviewCount;
    return b.avgRating - a.avgRating;
  });

  const leaderboardList = document.getElementById("leaderboardList");
  leaderboardList.innerHTML = "";

  professors.forEach(prof => {
    const li = document.createElement("li");
    li.className = "p-3 border rounded-lg bg-white flex justify-between items-center hover:bg-gray-50 cursor-pointer transition";
    li.textContent = `${prof.name} — Avg: ${prof.avgRating.toFixed(1)}/5 (${prof.reviewCount} reviews)`;

    li.addEventListener("click", () => {
      // simulate selecting professor in the search
      selectedProfId = prof.id;
      profName.dataset.name = prof.name;
      profName.textContent = prof.name;
      ratingSection.style.display = "block";
      professorSearch.value = prof.name;
      document.getElementById("professorList").innerHTML = "";

      // load their reviews
      loadReviews(selectedProfId);
    });

    leaderboardList.appendChild(li);
  });
}


async function loadNavbarUser() {
  const { data: { session } } = await supabaseClient.auth.getSession();
  const authStatus = document.getElementById("authStatus");
  if (!authStatus) return;

  if (!session || !session.user) {
    authStatus.innerHTML = "";
    return;
  }

  const user = session.user;

  // Use first letter of email as avatar
  const firstLetter = (user.email || "U")[0].toUpperCase();

  authStatus.innerHTML = `
    <div class="flex items-center gap-2">
      <div class="w-8 h-8 rounded-full bg-gray-300 text-gray-700 flex items-center justify-center font-bold">
        ${firstLetter}
      </div>
      <button
        id="logoutBtn"
        class="text-red-600 hover:underline font-medium"
      >
        Sign out
      </button>
    </div>
  `;

  document.getElementById("logoutBtn").addEventListener("click", async () => {
    await supabaseClient.auth.signOut();
    window.location.href = "/login.html";
  });
}


// ------------------------
// Load Professors
// ------------------------
async function loadProfessors() {
  const { data, error } = await supabaseClient
    .from("professors")
    .select("*")
    .order("name", { ascending: true });

  if (error) {
    console.error("Error loading professors:", error);
    return;
  }
  professors = data;
}

// ------------------------
// Populate Professor List
// ------------------------
function populateList(filtered) {
  professorList.innerHTML = "";
  filtered.forEach(prof => {
    const li = document.createElement("li");
    li.textContent = prof.name;
    li.dataset.id = prof.id;
    li.className = "p-2 mb-1 border rounded-lg cursor-pointer hover:bg-gray-100 transition";

    li.addEventListener("click", async () => {
      selectedProfId = prof.id;
      profName.dataset.name = prof.name;
      profName.textContent = prof.name;
      ratingSection.style.display = "block";
      professorSearch.value = prof.name;
      professorList.innerHTML = "";

      // 1-Review Unlock Logic
      const { data: { session } } = await supabaseClient.auth.getSession();
      if (!session || !session.user) {
        alert("You must be logged in to submit a review.");
        return;
      }
      const userId = session.user.id;

      const { data: userReviews, error } = await supabaseClient
        .from("reviews")
        .select("id")
        .eq("user_id", userId);

      if (error) {
        console.error("Failed to fetch user reviews:", error.message);
        return;
      }

      if (userReviews.length === 0) {
        reviewsDiv.innerHTML = `
          <p class="text-yellow-500 mb-2">
            You need to submit your first review (for any professor) to unlock other students' reviews.
          </p>
        `;
      } else {
        // User has at least one review → show all reviews
        loadReviews(selectedProfId);
      }
    });

    professorList.appendChild(li);
  });
}

// ------------------------
// Live Search
// ------------------------
professorSearch.addEventListener("input", () => {
  const query = professorSearch.value.toLowerCase();
  const filtered = professors.filter(p => p.name.toLowerCase().includes(query));
  populateList(filtered);
});

// Show full list on focus
professorSearch.addEventListener("focus", () => {
  populateList(professors);
});
async function voteReview(reviewId, value) {
  const { data: { session } } = await supabaseClient.auth.getSession();
  if (!session) return [];

  const userId = session.user.id;

  if (value === 0) {
    await supabaseClient
      .from("review_votes")
      .delete()
      .eq("review_id", reviewId)
      .eq("user_id", userId);
  } else {
    await supabaseClient
      .from("review_votes")
      .upsert(
        { review_id: reviewId, user_id: userId, vote: value },
        { onConflict: ["review_id", "user_id"] }
      );
  }

  const { data } = await supabaseClient
    .from("review_votes")
    .select("user_id, vote")
    .eq("review_id", reviewId);

  return data || [];
}
async function submitVote(reviewId, newVote, netVoteEl, upBtn, downBtn) {
  // Get current user
  const { data: { session } } = await supabaseClient.auth.getSession();
  if (!session || !session.user) return alert("You must be logged in.");
  const userId = session.user.id;

  // Upsert vote
  const { error } = await supabaseClient
    .from("review_votes")
    .upsert(
      { review_id: reviewId, user_id: userId, vote: newVote },
      { onConflict: ["review_id", "user_id"] }
    );

  if (error) return alert("Failed to vote: " + error.message);

  // Update UI locally without reloading all reviews
  // Get current counts
  let upvotes = parseInt(upBtn.dataset.count || "0");
  let downvotes = parseInt(downBtn.dataset.count || "0");
  let currentVote = parseInt(netVoteEl.dataset.userVote || "0");

  // Remove previous vote if any
  if (currentVote === 1) upvotes--;
  if (currentVote === -1) downvotes--;

  // Apply new vote
  if (newVote === 1) upvotes++;
  if (newVote === -1) downvotes++;

  // Update net vote display
  const netVote = upvotes - downvotes;
  netVoteEl.textContent = netVote;

  // Store counts for future clicks
  upBtn.dataset.count = upvotes;
  downBtn.dataset.count = downvotes;
  netVoteEl.dataset.userVote = newVote;

  // Toggle button styles
  upBtn.className = newVote === 1
    ? "bg-green-600 text-white px-1 rounded"
    : "border border-green-600 text-green-600 px-1 rounded";

  downBtn.className = newVote === -1
    ? "bg-red-600 text-white px-1 rounded"
    : "border border-red-600 text-red-600 px-1 rounded";
}



// ------------------------
// Load Reviews
// ------------------------
// ------------------------
// Load Reviews with Sorting
// ------------------------
async function loadReviews(profId, sort = "recent") {
  const reviewsDiv = document.getElementById("reviews");
  if (!reviewsDiv) return;

  // 1️⃣ Fetch reviews
  const { data: reviewsData, error: reviewsError } = await supabaseClient
    .from("reviews")
    .select(`
      id,
      user_id,
      rating,
      comment,
      course,
      would_take_again,
      created_at,
      review_votes ( vote, user_id )
    `)
    .eq("professor_id", profId);

  if (reviewsError) {
    reviewsDiv.innerHTML = `<p class="text-red-500">Failed to load reviews: ${reviewsError.message}</p>`;
    return;
  }

  let reviews = Array.isArray(reviewsData) ? reviewsData : [];
  reviewsDiv.innerHTML = "";

  if (reviews.length === 0) {
    reviewsDiv.innerHTML = "<p>No reviews yet. Be the first to rate!</p>";
    return;
  }

  // 2️⃣ Sort reviews
  switch(sort) {
    case "recent":
      reviews.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
      break;
    case "popular":
      reviews.sort((a, b) => {
        const netA = (a.review_votes || []).filter(v => v.vote === 1).length
                   - (a.review_votes || []).filter(v => v.vote === -1).length;
        const netB = (b.review_votes || []).filter(v => v.vote === 1).length
                   - (b.review_votes || []).filter(v => v.vote === -1).length;
        return netB - netA; // descending
      });
      break;
    case "ratingDesc":
      reviews.sort((a, b) => (b.rating || 0) - (a.rating || 0));
      break;
    case "ratingAsc":
      reviews.sort((a, b) => (a.rating || 0) - (b.rating || 0));
      break;
  }

  // 3️⃣ Calculate average rating
  const ratings = reviews.map(r => r.rating).filter(r => r != null);
  const avgRating = ratings.length > 0
    ? (ratings.reduce((a, b) => a + b, 0) / ratings.length).toFixed(1)
    : "N/A";

  const profName = document.getElementById("profName");
  profName.textContent = `${profName.dataset.name} (Avg: ${avgRating}/5)`;

  // 4️⃣ Get current user
  const { data: { session } } = await supabaseClient.auth.getSession();
  const userId = session?.user?.id;

  // 5️⃣ Render reviews
  for (const r of reviews) {
    const reviewEl = document.createElement("div");
    reviewEl.className = "p-4 border rounded-lg bg-white shadow-sm mb-4 relative";

    // Timestamp
    const date = new Date(r.created_at).toLocaleString();
    const dateEl = document.createElement("p");
    dateEl.className = "absolute top-2 right-2 text-xs text-gray-400";
    dateEl.textContent = date;
    reviewEl.appendChild(dateEl);

    // Info line
    const infoEl = document.createElement("p");
    infoEl.className = "font-medium mb-2 flex gap-4";
    infoEl.innerHTML = `
      <span><strong>Course:</strong> ${r.course || "N/A"}</span>
      <span><strong>Rating:</strong> ${r.rating ?? "N/A"}/5</span>
      <span><strong>Would take again:</strong> ${r.would_take_again == null ? "N/A" : r.would_take_again ? "Yes" : "No"}</span>
    `;
    reviewEl.appendChild(infoEl);

    // Comment
    const commentEl = document.createElement("p");
    commentEl.textContent = r.comment;
    reviewEl.appendChild(commentEl);

    // Reddit-style voting
    const votesRow = document.createElement("div");
    votesRow.className = "flex items-center gap-2 mt-2";

    const votes = Array.isArray(r.review_votes) ? r.review_votes : [];
    let upvotes = votes.filter(v => v.vote === 1).length;
    let downvotes = votes.filter(v => v.vote === -1).length;
    let netVote = upvotes - downvotes;

    let userVote = 0;
    if (userId) {
      const myVote = votes.find(v => v.user_id === userId);
      userVote = myVote ? myVote.vote : 0;
    }

    const netVoteEl = document.createElement("span");
    netVoteEl.textContent = netVote;
    netVoteEl.className = "font-bold text-lg mx-2 select-none";

    const upBtn = document.createElement("button");
    upBtn.innerHTML = "▲";
    upBtn.className = userVote === 1
      ? "bg-green-600 text-white px-1 rounded"
      : "border border-green-600 text-green-600 px-1 rounded";

    const downBtn = document.createElement("button");
    downBtn.innerHTML = "▼";
    downBtn.className = userVote === -1
      ? "bg-red-600 text-white px-1 rounded"
      : "border border-red-600 text-red-600 px-1 rounded";

    votesRow.append(upBtn, netVoteEl, downBtn);
    reviewEl.appendChild(votesRow);

    // Voting logic
upBtn.addEventListener("click", async () => {
  const newVote = userVote === 1 ? 0 : 1;
  await submitVote(r.id, newVote, netVoteEl, upBtn, downBtn);
  userVote = newVote; // update local reference
});

downBtn.addEventListener("click", async () => {
  const newVote = userVote === -1 ? 0 : -1;
  await submitVote(r.id, newVote, netVoteEl, upBtn, downBtn);
  userVote = newVote; // update local reference
});


    // Edit/Delete for owner
    if (userId && r.user_id === userId) {
      const controls = document.createElement("div");
      controls.className = "mt-2 flex gap-2 text-sm";

      const editBtn = document.createElement("button");
      editBtn.textContent = "Edit";
      editBtn.className = "text-blue-500 hover:underline";
      editBtn.onclick = () => editReview(r);

      const delBtn = document.createElement("button");
      delBtn.textContent = "Delete";
      delBtn.className = "text-red-500 hover:underline";
      delBtn.onclick = () => deleteReview(r.id);

      controls.append(editBtn, delBtn);
      reviewEl.appendChild(controls);
    }

    reviewsDiv.appendChild(reviewEl);
  }
}



// ------------------------
// Edit Review
// ------------------------
async function editReview(review) {
  ratingInput.value = review.rating || "";
  commentInput.value = review.comment || "";
  courseInput.value = review.course || "";
  wouldTakeAgainSelect.value =
    review.would_take_again === true ? "true" :
    review.would_take_again === false ? "false" : "";



  submitBtn.textContent = "Update Review";

  const updateHandler = async () => {
    const rating = parseInt(ratingInput.value);
    const comment = commentInput.value.trim();
    const course = courseInput.value.trim();
    const wouldTakeAgain = wouldTakeAgainSelect.value;

    if (!comment) return alert("Enter a comment.");

    const { data: { session } } = await supabaseClient.auth.getSession();
    if (!session || !session.user) return alert("You must be logged in.");
    const userId = session.user.id;

    const { error } = await supabaseClient
      .from("reviews")
      .update({
        rating: isNaN(rating) ? null : rating,
        comment,
        course: course || null,
        would_take_again: wouldTakeAgain === "true" ? true : wouldTakeAgain === "false" ? false : null
      })
      .eq("id", review.id)
      .eq("user_id", userId);

    if (error) return alert("Failed to update review: " + error.message);

    ratingInput.value = "";
    commentInput.value = "";
    courseInput.value = "";
    wouldTakeAgainSelect.value = "";
    submitBtn.textContent = "Submit Review";

    submitBtn.removeEventListener("click", updateHandler);
    submitBtn.addEventListener("click", submitReviewHandler);

    await loadReviews(profId);
  };

  submitBtn.removeEventListener("click", submitReviewHandler);
  submitBtn.addEventListener("click", updateHandler);
}

// ------------------------
// Delete Review
// ------------------------
async function deleteReview(reviewId) {
  if (!confirm("Are you sure you want to delete this review?")) return;

  const { data: { session } } = await supabaseClient.auth.getSession();
  if (!session || !session.user) return alert("You must be logged in.");
  const userId = session.user.id;

  const { error } = await supabaseClient
    .from("reviews")
    .delete()
    .eq("id", reviewId)
    .eq("user_id", userId);

  if (error) return alert("Failed to delete review: " + error.message);

  loadReviews(selectedProfId);
}

// ------------------------
// Submit Review
// ------------------------
async function submitReviewHandler() {
  const comment = commentInput.value.trim();
  const rating = parseInt(ratingInput.value);
  const course = courseInput.value.trim();
  const wouldTakeAgain = wouldTakeAgainSelect.value;

  if (!selectedProfId) return alert("Please select a professor first.");
  if (!comment) return alert("Please enter a comment.");

  const { data: { session } } = await supabaseClient.auth.getSession();
  if (!session || !session.user) return alert("You must be logged in.");
  const userId = session.user.id;

  const { error } = await supabaseClient.from("reviews").insert([{
    user_id: userId,
    professor_id: selectedProfId,
    rating: rating || null,
    comment,
    course: course || null,
    would_take_again: wouldTakeAgain === "true" ? true : null
  }]);

  if (error) {
    if (error.message.includes("duplicate key")) {
      return alert("You’ve already submitted a review for this professor. You can edit or delete your existing review.");
    }
    return alert("Failed to submit review: " + error.message);
  }

  ratingInput.value = "";
  commentInput.value = "";
  courseInput.value = "";
  wouldTakeAgainSelect.value = "";

  loadReviews(selectedProfId);
}

// ------------------------
// Voting
// ------------------------
async function vote(reviewId, value) {
  const { data: { session } } = await supabaseClient.auth.getSession();
  if (!session) return alert("You must be logged in.");
  const userId = session.user.id;

  const { error } = await supabaseClient
    .from("review_votes")
    .upsert({
      review_id: reviewId,
      user_id: userId,
      vote: value
    }, { onConflict: ["review_id", "user_id"] });

  if (error) return alert("Failed to vote: " + error.message);

  loadReviews(selectedProfId);
}

// ------------------------
// Initialize Page
// ------------------------
window.addEventListener("DOMContentLoaded", async () => {
  await protectPage();
  await loadProfessors();
  await loadNavbarUser();
  await loadTopProfessors();
});
submitBtn.addEventListener("click", submitReviewHandler);
const sortSelect = document.getElementById("sortReviews");
sortSelect.addEventListener("change", () => {
  const sortValue = sortSelect.value;
  if (selectedProfId) loadReviews(selectedProfId, sortValue);
});











  
