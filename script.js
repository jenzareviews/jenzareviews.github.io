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
const allProfessorsList = document.getElementById("allProfessorsList");
const ratingSection = document.getElementById("ratingSection");
const profName = document.getElementById("profName");
const reviewsDiv = document.getElementById("reviews");
const ratingInput = document.getElementById("rating");
const commentInput = document.getElementById("comment");
const courseInput = document.getElementById("course");
const wouldTakeAgainSelect = document.getElementById("wouldTakeAgain");
const submitBtn = document.getElementById("submitRating");
const departmentFilter = document.getElementById("departmentFilter");
const highestRatedToggle = document.getElementById("highestRatedToggle");

// ------------------------
// Global State
// ------------------------
let professors = [];
let selectedProfId = null;
let currentInlineReviewsContainer = null;


// ------------------------
// Load Navbar User
// ------------------------
async function loadNavbarUser() {
  const { data: { session } } = await supabaseClient.auth.getSession();
  const authStatus = document.getElementById("authStatus");
  if (!authStatus) return;
  if (!session || !session.user) {
    authStatus.innerHTML = "";
    return;
  }
  const user = session.user;
  const firstLetter = (user.email || "U")[0].toUpperCase();
  authStatus.innerHTML = `
    <div class="flex items-center gap-2">
      <div class="w-8 h-8 rounded-full bg-gray-300 text-gray-700 flex items-center justify-center font-bold">
        ${firstLetter}
      </div>
      <button id="logoutBtn" class="text-red-600 hover:underline font-medium">Sign out</button>
    </div>
  `;
  document.getElementById("logoutBtn").addEventListener("click", async () => {
    await supabaseClient.auth.signOut();
    window.location.href = "/login.html";
  });
}

// ------------------------
// Load All Professors With Stats
// ------------------------
async function loadAllProfessorsWithStats() {
  const { data, error } = await supabaseClient
    .from("professors")
    .select(`id, name, department, reviews(rating)`)
    .order("name", { ascending: true });
  if (error) {
    console.error("Failed to load all professors:", error);
    return;
  }
  professors = data;
  populateDepartmentFilter(data);
  renderAllProfessors(data);
}

// ------------------------
// Render Professors
// ------------------------
function renderAllProfessors(list) {
  if (!allProfessorsList) return console.error("Element #allProfessorsList not found!");
  allProfessorsList.innerHTML = "";
  list.forEach(prof => {
    const ratings = (prof.reviews || []).map(r => r.rating).filter(r => r != null);
    const reviewCount = ratings.length;
    const avgRating = reviewCount ? (ratings.reduce((a, b) => a + b, 0) / reviewCount).toFixed(1) : null;
    const li = document.createElement("li");
    li.className = "p-4 border rounded-lg bg-white hover:bg-gray-50 cursor-pointer transition";
    li.innerHTML = `
      <div class="flex justify-between items-center">
        <div>
          <p class="font-semibold">${prof.name}</p>
          <p class="text-sm text-gray-500">${prof.department || "Unknown department"}</p>
        </div>
        <div class="text-right">
          ${
            reviewCount
              ? `<p class="font-medium">${avgRating}/5</p>
                 <p class="text-sm text-gray-500">${reviewCount} review${reviewCount > 1 ? "s" : ""}</p>`
              : `<p class="text-sm text-yellow-600">No reviews yet — be the first!</p>`
          }
        </div>
      </div>
    `;
   // create inline reviews container
const inlineReviews = document.createElement("div");
inlineReviews.className = "mt-4 hidden";
li.appendChild(inlineReviews);

li.addEventListener("click", async () => {
  const isOpen = !inlineReviews.classList.contains("hidden");

  // close others
  document.querySelectorAll(".inline-reviews").forEach(el => {
    el.classList.add("hidden");
  });

  if (isOpen) {
    inlineReviews.classList.add("hidden");
    return;
  }

  // MOVE full review UI here
  inlineReviews.appendChild(ratingSection);
  currentInlineReviewsContainer = reviewsDiv; // reviewsDiv inside ratingSection


  ratingSection.classList.remove("hidden"); // 🔴 REQUIRED
  ratingSection.style.display = "block";

  inlineReviews.classList.remove("hidden");
  inlineReviews.classList.add("inline-reviews");

  inlineReviews.addEventListener("click", e => e.stopPropagation());

  selectedProfId = prof.id;

  await loadReviews(prof.id);
});



    allProfessorsList.appendChild(li);
  });
}

// ------------------------
// Department Filter + Highest Rated
// ------------------------
function populateDepartmentFilter(data) {
  const departments = [...new Set(data.map(p => p.department).filter(Boolean))].sort();
  departmentFilter.innerHTML = `<option value="">All Departments</option>`;
  departments.forEach(dep => {
    const opt = document.createElement("option");
    opt.value = dep;
    opt.textContent = dep;
    departmentFilter.appendChild(opt);
  });
}
function applyProfessorFilters() {
  let filtered = [...professors];
  // Department filter
  const selectedDepartment = departmentFilter.value;
  if (selectedDepartment) {
    filtered = filtered.filter(p => p.department === selectedDepartment);
  }
  // Highest Rated toggle
  if (highestRatedToggle.checked) {
    filtered.sort((a, b) => {
      const aRatings = (a.reviews || []).map(r => r.rating).filter(r => r != null);
      const bRatings = (b.reviews || []).map(r => r.rating).filter(r => r != null);
      const aAvg = aRatings.length ? aRatings.reduce((x, y) => x + y, 0) / aRatings.length : 0;
      const bAvg = bRatings.length ? bRatings.reduce((x, y) => x + y, 0) / bRatings.length : 0;
      return bAvg - aAvg;
    });
  }
  renderAllProfessors(filtered);
}
departmentFilter.addEventListener("change", applyProfessorFilters);
highestRatedToggle.addEventListener("change", applyProfessorFilters);

// ------------------------
// Live Search
// ------------------------
professorSearch.addEventListener("input", () => {
  const query = professorSearch.value.toLowerCase();
  const filtered = professors.filter(p => p.name.toLowerCase().includes(query));
  renderAllProfessors(filtered);
});

// ------------------------
// Load Reviews (OG logic intact)
// ------------------------
async function loadReviews(profId, sort = "recent", targetDiv = reviewsDiv) {
  if (!profId) return;
  const { data: reviewsData, error } = await supabaseClient
    .from("reviews")
    .select(`id, user_id, rating, comment, course, would_take_again, created_at, review_votes(vote, user_id)`)
    .eq("professor_id", profId);
  if (error) {
    targetDiv.innerHTML = `<p class="text-red-500">Failed to load reviews: ${error.message}</p>`;
    return;
  }
  const { data: { session } } = await supabaseClient.auth.getSession();
  const userId = session?.user?.id;
  let reviews = reviewsData || [];
  targetDiv.innerHTML = "";
  if (!reviews.length) {
    targetDiv.innerHTML = "<p>No reviews yet. Be the first to rate!</p>";
    return;
  }

  // ------------------------
  // Edit Review
  // ------------------------
  async function editReview(review, profId) {
    if (!profId) return alert("Professor ID missing!");
    // Fill form with existing review
    ratingInput.value = review.rating || "";
    commentInput.value = review.comment || "";
    courseInput.value = review.course || "";
    wouldTakeAgainSelect.value = review.would_take_again === true ? "true" : review.would_take_again === false ? "false" : "";
    submitBtn.textContent = "Update Review";

    // Remove previous handlers
    submitBtn.replaceWith(submitBtn.cloneNode(true));
    const newSubmitBtn = document.getElementById("submitRating");

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
      newSubmitBtn.textContent = "Submit Review";

      // Rebind original submit
      newSubmitBtn.addEventListener("click", submitReviewHandler);

      // Reload reviews
      await loadReviews(profId);
    };

    newSubmitBtn.addEventListener("click", updateHandler);
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

    // Refresh reviews
    await loadReviews(selectedProfId);
  }

  // Sort reviews
  switch(sort) {
    case "recent": reviews.sort((a,b)=> new Date(b.created_at)-new Date(a.created_at)); break;
    case "popular":
      reviews.sort((a,b)=>{
        const net = r=> (r.review_votes||[]).filter(v=>v.vote===1).length - (r.review_votes||[]).filter(v=>v.vote===-1).length;
        return net(b)-net(a);
      }); break;
    case "ratingDesc": reviews.sort((a,b)=>(b.rating||0)-(a.rating||0)); break;
    case "ratingAsc": reviews.sort((a,b)=>(a.rating||0)-(b.rating||0)); break;
  }

  const avgRating = reviews.map(r=>r.rating).filter(r=>r!=null);
  const displayAvg = avgRating.length ? (avgRating.reduce((a,b)=>a+b,0)/avgRating.length).toFixed(1) : "N/A";
  profName.textContent = `${profName.dataset.name} (Avg: ${displayAvg}/5)`;

  // Render reviews (OG upvote/edit/delete intact)
  reviews.forEach(r => {
    const reviewEl = document.createElement("div");
    reviewEl.className = "p-4 border rounded-lg bg-white shadow-sm mb-4 relative";

    const dateEl = document.createElement("p");
    dateEl.className = "absolute top-2 right-2 text-xs text-gray-400";
    dateEl.textContent = new Date(r.created_at).toLocaleString();
    reviewEl.appendChild(dateEl);

    reviewEl.innerHTML += `
      <p class="font-medium mb-2 flex gap-4">
        <span><strong>Course:</strong> ${r.course||"N/A"}</span>
        <span><strong>Rating:</strong> ${r.rating??"N/A"}/5</span>
        <span><strong>Would take again:</strong> ${r.would_take_again==null?"N/A":r.would_take_again?"Yes":"No"}</span>
      </p>
      <p>${r.comment}</p>
    `;

    // Votes
    const votesRow = document.createElement("div");
    votesRow.className = "flex items-center gap-2 mt-2";
    const votes = r.review_votes || [];
    let upvotes = votes.filter(v=>v.vote===1).length;
    let downvotes = votes.filter(v=>v.vote===-1).length;
    let netVote = upvotes-downvotes;
    let userVote = 0;
    if(userId){ const myVote = votes.find(v=>v.user_id===userId); userVote=myVote?myVote.vote:0; }

    const netVoteEl = document.createElement("span");
    netVoteEl.textContent = netVote;
    netVoteEl.className = "font-bold text-lg mx-2 select-none";

    const upBtn = document.createElement("button");
    upBtn.innerHTML="▲";
    upBtn.className=userVote===1?"bg-green-600 text-white px-1 rounded":"border border-green-600 text-green-600 px-1 rounded";
    const downBtn=document.createElement("button");
    downBtn.innerHTML="▼";
    downBtn.className=userVote===-1?"bg-red-600 text-white px-1 rounded":"border border-red-600 text-red-600 px-1 rounded";

    votesRow.append(upBtn, netVoteEl, downBtn);
    reviewEl.appendChild(votesRow);

    upBtn.addEventListener("click", async ()=>{
      const newVote = userVote===1?0:1;
      await submitVote(r.id,newVote,netVoteEl,upBtn,downBtn);
      userVote=newVote;
    });
    downBtn.addEventListener("click", async ()=>{
      const newVote = userVote===-1?0:-1;
      await submitVote(r.id,newVote,netVoteEl,upBtn,downBtn);
      userVote=newVote;
    });

    // Edit/Delete
    if(userId && r.user_id===userId){
      const controls=document.createElement("div");
      controls.className="mt-2 flex gap-2 text-sm";

      const editBtn=document.createElement("button");
      editBtn.textContent="Edit";
      editBtn.className="text-blue-500 hover:underline";
      editBtn.onclick=()=>editReview(r,selectedProfId);

      const delBtn=document.createElement("button");
      delBtn.textContent="Delete";
      delBtn.className="text-red-500 hover:underline";
      delBtn.onclick=()=>deleteReview(r.id);

      controls.append(editBtn,delBtn);
      reviewEl.appendChild(controls);
    }

    targetDiv.appendChild(reviewEl);

  });
}

// ------------------------
// Submit Review (OG logic)
// ------------------------
async function submitReviewHandler() {
  const comment = commentInput.value.trim();
  const rating = parseInt(ratingInput.value);
  const course = courseInput.value.trim();
  const wouldTakeAgain = wouldTakeAgainSelect.value;
  if(!selectedProfId) return alert("Please select a professor first.");
  if(!comment) return alert("Please enter a comment.");

  const { data: { session } } = await supabaseClient.auth.getSession();
  if(!session || !session.user) return alert("You must be logged in.");
  const userId = session.user.id;

  const { error } = await supabaseClient.from("reviews").insert([{
    user_id:userId,
    professor_id:selectedProfId,
    rating: rating||null,
    comment,
    course: course||null,
    would_take_again: wouldTakeAgain==="true"?true:null
  }]);

  if(error){
    if(error.message.includes("duplicate key")){
      return alert("You’ve already submitted a review for this professor. Edit or delete your existing review.");
    }
    return alert("Failed to submit review: "+error.message);
  }

  ratingInput.value="";
  commentInput.value="";
  courseInput.value="";
  wouldTakeAgainSelect.value="";

  await loadReviews(selectedProfId);
}

// ------------------------
// Submit Vote (OG logic)
// ------------------------
async function submitVote(reviewId,newVote,netVoteEl,upBtn,downBtn){
  const { data: { session } } = await supabaseClient.auth.getSession();
  if(!session || !session.user) return alert("You must be logged in.");
  const userId = session.user.id;

  const { error } = await supabaseClient
    .from("review_votes")
    .upsert({review_id:reviewId,user_id:userId,vote:newVote},{onConflict:["review_id","user_id"]});
  if(error) return alert("Failed to vote: "+error.message);

  // update UI locally
  let upvotes=parseInt(upBtn.dataset.count||"0");
  let downvotes=parseInt(downBtn.dataset.count||"0");
  let currentVote=parseInt(netVoteEl.dataset.userVote||"0");

  if(currentVote===1) upvotes--;
  if(currentVote===-1) downvotes--;
  if(newVote===1) upvotes++;
  if(newVote===-1) downvotes++;

  const net=upvotes-downvotes;
  netVoteEl.textContent=net;
  upBtn.dataset.count=upvotes;
  downBtn.dataset.count=downvotes;
  netVoteEl.dataset.userVote=newVote;

  upBtn.className=newVote===1?"bg-green-600 text-white px-1 rounded":"border border-green-600 text-green-600 px-1 rounded";
  downBtn.className=newVote===-1?"bg-red-600 text-white px-1 rounded":"border border-red-600 text-red-600 px-1 rounded";
}

// ------------------------
// Initialize
// ------------------------
window.addEventListener("DOMContentLoaded", async ()=>{
  await protectPage();
  await loadNavbarUser();
  await loadAllProfessorsWithStats();
  submitBtn.addEventListener("click", submitReviewHandler);

  const sortDropdown = document.getElementById("sortReviews");

sortDropdown.addEventListener("change", async () => {
  if (!selectedProfId) return; // do nothing if no professor is selected
  await loadReviews(selectedProfId, sortDropdown.value, currentInlineReviewsContainer);
});

});














  



















